app.service("Onus", function ($rootScope, dialogService, Map, $timeout, SmartOlt, IntegraOlt) {

    $rootScope.isLoading = false;
    $min = 70;
    $max = 3600;
    $mainmin = 100;
    $x = 0;


    var self = {
        isLoading: false,
        wide_onus: false,
        showOnusPage: false,
        showVlanPage: false,
        showAddVlanPage: false,
        showOltsPage: true,
        showPonsPage: false,
        showUplinksPage: false,

        message_error: null,
        editing_olt: false,
        selected_olt: null,

        // This flag is set in cases where the clients are loaded before
        // the onus are. In these cases, client signals (and colors) are set 
        // when onus finish loading
        setSignalsOnClients: false,

        updateDashboardDataInterval: null,
        dashboardDataLoading: false,

        /**
         * Hides all pages
         */
        hideAllPages: function () {
            self.showAddOltPage = false;
            self.showOnusPage = false;
            self.showOltsPage = false;
            self.showVlanPage = false;
            self.showAddVlanPage = false;
            self.showPonsPage = false;
            self.showUplinksPage = false;
            self.showDashboardPage = false;
            self.showUnauthorizedOnusPage = false;
        },

        /**
         * Routing
         * 
         * Toggle between pages basen on clicks on the top navigation bar
         */
        showPage: function (page) {
            self.hideAllPages();
            if (page === "Onus") {
                self.showOnusPage = true;
                self.viewONUs();
            } else if (page === "Olts") {
                self.showOltsPage = true;
                self.listOltTypes();
                self.listOlts();
            } else if (page === "AddOlt") {
                self.showAddOltPage = true;
                $rootScope.form = {};
            } else if (page === "EditOlt") {
                self.showAddOltPage = true;
            } else if (page === "Vlans") {
                self.listVlans();
                self.showVlanPage = true;
            } else if (page === "AddVlan") {
                self.showAddVlanPage = true;
                $rootScope.form = {};
            } else if (page === "EditVlan") {
                self.showAddVlanPage = true;
            } else if (page === "Pons") {
                self.listPons();
                self.listVlans();
                self.showPonsPage = true;
            } else if (page === "UPLinks") {
                self.listVlans();
                self.listUPLinks();
                self.showUplinksPage = true;
            } else if (page === "Dashboard") {
                // Update dashboard data now, and start interval
                self.startUpdateDashboardInterval();
                self.showDashboardPage = true;
            } else if (page === "UnauthorizedOnus") {
                self.listUnauthorizedOnus();
                self.showUnauthorizedOnusPage = true;
            }

            if (page !== "Dashboard") {
                // If didn't change to dashboard,
                // clear dashboard data update interval
                clearInterval(self.updateDashboardDataInterval);
            }

        },

        /**
         * Open sidebar, and show specified page
         */
        openAndshowPage: function (page) {
            self.onusView();
            self.showPage(page);
        },

        /**
         * Remove intervalo existente, caso exista, 
         * e inicia um novo intervalo a cada 30 segundos, para atualizar
         * os dados do dashboard de monitoramento;
         */
        startUpdateDashboardInterval() {
            clearInterval(self.updateDashboardDataInterval);
            self.updateDashboardData();
            self.updateDashboardDataInterval = setInterval(self.updateDashboardData, 30000);
        },


        /**
        * Open the view ONUs Modal
        * */
        viewONUs: function () {
            $rootScope.isLoading = true;
            $.ajax({
                url: $rootScope.base_url + "/Onus/list_all",
                type: "POST",
                //data: {id:id},
                success: function (data) {

                    if (data) {
                        $rootScope.onus = [];
                        $rootScope.onus = data;
                        console.log("got onus:", $rootScope.onus);

                        // Set olt name for each onu
                        $rootScope.onus.forEach(onu => {
                            if (onu.olt_port) {
                                onu.olt = onu.olt_port.olt.nome;
                            } else {
                                onu.olt = "Not found";
                            }
                        });

                        // pagination controls
                        $rootScope.currentPage = 1;
                        $rootScope.totalItems = $rootScope.onus.length;
                        $rootScope.entryLimit = Math.ceil($(".onusdiv").height() / 51); // items per page
                        $rootScope.isLoading = false;

                        // AFTER THIS IS READY, Redraw clients that may have new signals because
				        // onus were loaded later
                        if ($rootScope.treeviewIsInitialized){
                            self.setClientSignals();
                        } else {
                            self.waitEvertythingLoadedInterval = setInterval(() => {
                                if ($rootScope.treeviewIsInitialized){
                                    clearInterval(self.waitEvertythingLoadedInterval);
                                    self.setClientSignals();
                                }
                            }, 1000);
                        }
                    }

                    $rootScope.$apply();
                }
            });

            $rootScope.classe1 = "selecionado";
            $rootScope.classe2 = "negrito";

            $rootScope.ordenar = function (campo) {
                $rootScope.ordenado = campo;
                $rootScope.dirordenado = !$rootScope.dirordenado;
            };
        },

        listUnauthorizedOnus: function () {
            $rootScope.isLoading = true;
            $.ajax({
                url: $rootScope.base_url + "/Onus/list_all_unauthorized",
                type: "POST",
                success: function (data) {
                    if (data) {
                        $rootScope.unauthorizedOnus = [];
                        $rootScope.unauthorizedOnus = data;
                        // Format Date
                        $rootScope.unauthorizedOnus.forEach(onu => {
                            var datetime = new Date(onu.date_created);
                            onu.date_created = self.getReadableDate(datetime);
                        });

                        // pagination controls
                        $rootScope.currentPage = 1;
                        $rootScope.totalItems = $rootScope.unauthorizedOnus.length;
                        $rootScope.entryLimit = Math.ceil($(".onusdiv").height() / 51); // items per page
                        $rootScope.isLoading = false;
                    }

                    $rootScope.$apply();
                }
            });

            $rootScope.classe1 = "selecionado";
            $rootScope.classe2 = "negrito";

            $rootScope.ordenar = function (campo) {
                $rootScope.ordenado = campo;
                $rootScope.dirordenado = !$rootScope.dirordenado;
            };
        },

        /**
         * Sends request to backend to authorize an ONU
         * @param {*} onu 
         */
        authorizeOnu: function (onu) {
            console.log("AUTHORIZE: ", onu);
            // onuAuthIntegraOlt
            var options = {
                autoOpen: false,
                modal: true,
                title: $rootScope.Users.translateText("Autorizar ONU"),
                width: 500,
                height: "auto",
                resizable: false,
                dialogClass: "noclose",
                close: function () {
                    self.authorizingOnu = null;
                    $rootScope.form = {};
                    self.showAuthOnuSuccess = false;
                    self.authOnuSuccessMessage = null;
                    self.showAuthOnuError = false;
                    self.authOnuErrorMessage = null;
                }
            };
            self.authorizingOnu = onu;
            var model = [];
            self.selected_olt = onu.olt;
            self.listVlansNoTable();
            console.log("listed vlans");
            $rootScope.form = {
                authOnuLat: null,
                authOnuLng: null,
                authOnuMode: "bridge",
                authOnuName: null,
                authOnuVlan: null,
            };
            $rootScope.dialogService.open("onuAuthIntegraOlt", "onuAuthIntegraOlt", model, options);
        },

        /**
         * Sends authorization request to backend
         * with parameters for current ONU
         */
        authorizeOnuConfirm: function () {
            // Validate form data
            if (!self.validateAuthOnuData()) {
                return;
            }



            self.authOnuLoading = true;

            var dataSend = {
                unauthorized_onu_id: self.authorizingOnu.id,
                name: $rootScope.form.authOnuName,
                mode: $rootScope.form.authOnuMode,
                vlan: $rootScope.form.authOnuVlan,
                lat: $rootScope.form.authOnuLat,
                lng: $rootScope.form.authOnuLng,
            };
            $.ajax({
                url: $rootScope.base_url + "/Onus/authorize_onu",
                type: "POST",
                data: dataSend,
                success: function (data) {
                    self.authOnuLoading = false;
                    if (data.status) {
                        var time = 3000;
                        self.setAuthOnuSuccess("ONU autorizada com sucesso", time);
                        setTimeout(function () {
                            $rootScope.dialogService.close("onuAuthIntegraOlt");
                            self.listUnauthorizedOnus();
                        }, time);

                        //Send event to analytics
                        if ($rootScope.run_analytics) {
                            ga("send", {
                                hitType: "event",
                                eventCategory: "IntegraOLT Actions",
                                eventAction: "Authorize ONU - SUCCESS",
                                eventLabel: "Successfully authorized ONU"
                            });
                        }
                    } else {
                        console.error("AUTH ERROR:", data);
                        self.setAuthOnuError("Ocorreu um erro durante a autorização da ONU. Verifique os parâmetros e tente novamente.");
                    
                        //Send event to analytics
                        if ($rootScope.run_analytics) {
                            ga("send", {
                                hitType: "event",
                                eventCategory: "IntegraOLT Actions",
                                eventAction: "Authorize ONU - ERROR",
                                eventLabel: "Could not authorize ONU"
                            });
                        }
                    }
                },
                error: function (data) {
                    console.error("AUTH REQUEST ERROR:", data);
                    self.authOnuLoading = false;
                    self.setAuthOnuError("Ocorreu um erro durante a autorização da ONU. Verifique os parâmetros e tente novamente.");
                }
            });
        },

        /**
         * Validate form data
         */
        validateAuthOnuData: function () {
            // Name
            if ($rootScope.form.authOnuName == null || $rootScope.form.authOnuName == "") {
                self.setAuthOnuError("Preencha o nome para autorização da ONU");
                return false;
            }

            // Vlan
            if ($rootScope.form.authOnuVlan == null || $rootScope.form.authOnuVlan == "") {
                self.setAuthOnuError("Preencha a VLAN para autorização da ONU");
                return false;
            }

            // Lat
            if ($rootScope.form.authOnuLat == null || $rootScope.form.authOnuLat == "") {
                self.setAuthOnuError("Preencha a latitude para autorização da ONU");
                return false;
            }

            // Lat is number
            if (isNaN($rootScope.form.authOnuLat)) {
                self.setAuthOnuError("A latitude deve ser um número");
                return false;
            }

            // Lng
            if ($rootScope.form.authOnuLng == null || $rootScope.form.authOnuLng == "") {
                self.setAuthOnuError("Preencha a longitude para autorização da ONU");
                return false;
            }

            // Lng is number
            if (isNaN($rootScope.form.authOnuLng)) {
                self.setAuthOnuError("A longitude deve ser um número");
                return false;
            }

            return true;
        },

        /**
         * 
         */
        getCoordinatesByAddress: function () {
            self.authOnuLoadingCoords = true;

            var dataSend = {};
            dataSend.textSearch = $rootScope.form.authOnuCoordsAddress;
            var link = $rootScope.base_url + "/maps/get_location_text";
            $.ajax({
                url: link,
                data: dataSend,
                type: "POST",
                success: function (data) {
                    self.authOnuLoadingCoords = false;
                    if (data.data && data.status === 1) {
                        var geometry = data.data;
                        $rootScope.form.authOnuLat = geometry.location.lat;
                        $rootScope.form.authOnuLng = geometry.location.lng;
                    }
                    $rootScope.$apply();
                }
            });
        },

        /**
         * Sets error message on auth onu modal
         * @param {string} errorMessage 
         */
        setAuthOnuError: function (errorMessage) {
            self.showAuthOnuError = true;
            self.authOnuErrorMessage = errorMessage;
            $rootScope.$apply();
            setTimeout(function () {
                self.showAuthOnuError = false;
                self.authOnuErrorMessage = null;
                $rootScope.$apply();
            }, 5000);
        },

        /**
         * Sets success message on auth onu modal
         * @param {string} successMessage 
         */
        setAuthOnuSuccess: function (successMessage, time) {
            self.showAuthOnuSuccess = true;
            self.authOnuSuccessMessage = successMessage;
            $rootScope.$apply();
            setTimeout(function () {
                self.showAuthOnuSuccess = false;
                self.authOnuSuccessMessage = null;
                $rootScope.$apply();
            }, time);
        },

        /**
         * Sets success message on remove onu modal
         * @param {string} successMessage 
         */
        setRemoveOnuError: function (errorMessage) {
            self.showRemoveOnuError = true;
            self.removeOnuErrorMessage = errorMessage;
            $rootScope.$apply();
            setTimeout(function () {
                self.showRemoveOnuError = false;
                self.removeOnuErrorMessage = null;
                $rootScope.$apply();
            }, 5000);
        },

        /**
         * 
         */
        removeOnu: function (onu) {
            // removeOnuIntegraOlt
            var options = {
                autoOpen: false,
                modal: true,
                title: $rootScope.Users.translateText("Remover ONU"),
                width: 500,
                height: "auto",
                resizable: false,
                dialogClass: "noclose",
                close: function () {
                    self.removingOnu = null;
                    $rootScope.form = {};
                    self.showRemoveOnuSuccess = false;
                    self.removeOnuSuccessMessage = null;
                    self.showRemoveOnuError = false;
                    self.removeOnuErrorMessage = null;
                }
            };
            self.removingOnu = onu;
            var model = [];
            $rootScope.dialogService.open("removeOnuIntegraOlt", "removeOnuIntegraOlt", model, options);
        },

        /**
         * 
         */
        removeOnuConfirm: function () {
            console.log("removeConfirm ONU", self.removingOnu);

            if (self.removingOnu.olt_port_id == null || self.removingOnu.olt_port.olt_id == null) {
                self.setRemoveOnuError("Esta ONU não está associada a uma OLT.");
                return;
            }

            self.removeOnuLoading = true;
            dataSend = {
                serial: self.removingOnu.serial,
                olt_id: self.removingOnu.olt_port.olt_id
            };
            $.ajax({
                url: $rootScope.base_url + "/Onus/remove_onu",
                type: "POST",
                data: dataSend,
                success: function (data) {
                    self.removeOnuLoading = false;
                    if (data.status){
                        //Send event to analytics
                        if ($rootScope.run_analytics) {
                            ga("send", {
                                hitType: "event",
                                eventCategory: "IntegraOLT Actions",
                                eventAction: "Remove ONU - SUCCESS",
                                eventLabel: "Successfully removed ONU"
                            });
                        }
                    } else {
                        console.error("REMOVE ERROR:", data);
                        self.setRemoveOnuError("Ocorreu um erro durante a remoção da ONU.");
                        //Send event to analytics
                        if ($rootScope.run_analytics) {
                            ga("send", {
                                hitType: "event",
                                eventCategory: "IntegraOLT Actions",
                                eventAction: "Remove ONU - ERROR",
                                eventLabel: "Could not remove ONU"
                            });
                        }
                    }

                    // Reload ONUs
                    self.viewONUs();
                    $rootScope.dialogService.close("removeOnuIntegraOlt");
                },
                error: function (data) {
                    console.error("AUTH REQUEST ERROR:", data);
                    self.removeOnuLoading = false;
                    self.setRemoveOnuError("Ocorreu um erro durante a remoção da ONU.");
                }
            });
        },

        /**
         * Open configuration for ONU item
         * @param {*} onu 
         */
        openOnuConf: function (onu) {
            self.editingOnu = onu;
            self.editingOnu.currentDataLoaded = false;
            self.editingOnuOriginalName = onu.name;

            // FOR LATER
            //self.getCurrentOnuData();

            // If is integrated with smartOlt, show signal and traffic graphs
            if (SmartOlt.smartOltIntegrated) {
                self.getSmartOltGraphs();
            }

            // If is integrated with integraOlt, show signal and traffic graphs
            if (IntegraOlt.integraOltIntegrated) {
                self.integraOltGetOnuOpticalData();
            }

            self.editingOnu.currentDataLoaded = true;

            var options = {
                autoOpen: false,
                modal: true,
                title: $rootScope.Users.translateText("ONU Config"),
                width: 500,
                height: 570,
                resizable: true,
                dialogClass: "noclose",
                close: function () {
                    self.editingOnu.currentDataLoaded = false;
                    self.trafficGraphLoaded = false;
                    self.signalGraphLoaded = false;
                    self.editingOnu = null;
                    self.integraoltOpticalDataLoaded = false;
                }
            };
            var model = [];
            $rootScope.dialogService.open("onuConfig", "onuConfig", model, options);
        },

        /**
         * 
         */
        getSmartOltGraphs: function () {
            var dataSend = {
                sn: self.editingOnu.serial,
                interval: "daily"
            };

            self.signalGraphLoading = true;
            $.ajax({
                url: $rootScope.base_url + "/smartolt/get_onu_traffic_graph",
                type: "POST",
                data: dataSend,
                success: function (data) {
                    if (!data || data === "") {
                        return;
                    }
                    self.editingOnu.smartoltTrafficGraph = data;
                    self.trafficGraphLoaded = true;
                },
                complete: function () {
                    self.signalGraphLoading = false;
                    $rootScope.$apply();
                }
            });

            self.trafficGraphLoading = true;
            $.ajax({
                url: $rootScope.base_url + "/smartolt/get_onu_signal_graph",
                type: "POST",
                data: dataSend,
                success: function (data) {
                    if (!data || data === "") {
                        return;
                    }
                    self.editingOnu.smartoltSignalGraph = data;
                    self.signalGraphLoaded = true;
                },
                complete: function () {
                    self.trafficGraphLoading = false;
                    $rootScope.$apply();
                }
            });
        },

        /**
         * 
         */
        integraOltGetOnuOpticalData: function () {
            console.log(self.editingOnu);

            // Check if olt port is present, in order to get olt id
            if (!self.editingOnu.olt_port){
                return;
            }

            var dataSend = {
                "serial": self.editingOnu.serial,
                "olt_id": self.editingOnu.olt_port.olt.id
            };

            self.integraoltOpticalDataLoading = true;
            $.ajax({
                url: $rootScope.base_url + "/Onus/get_optical_data",
                type: "POST",
                data: dataSend,
                success: function (response) {
                    if (!response || response === "" || !response.status) {
                        console.log("get optical data error: ", response);
                        //Send event to analytics
                        if ($rootScope.run_analytics) {
                            ga("send", {
                                hitType: "event",
                                eventCategory: "IntegraOLT Actions",
                                eventAction: "Get optical info - ERROR",
                                eventLabel: "Could not get onu optical info"
                            });
                        }

                        return;
                    }

                    //Send event to analytics
                    if ($rootScope.run_analytics) {
                        ga("send", {
                            hitType: "event",
                            eventCategory: "IntegraOLT Actions",
                            eventAction: "Get optical info",
                            eventLabel: "Successfully got onu optical info"
                        });
                    }

                    self.integraoltOpticalDataLoaded = true;
                    self.editingOnu.rx = response.data.data.rx;
                    self.editingOnu.tx = response.data.data.tx;
                    self.editingOnu.olt_rx = response.data.data.olt_rx;
                },
                complete: function () {
                    self.integraoltOpticalDataLoading = false;
                    $rootScope.$apply();
                }
            });
            
        },

        /**
         * Get current ONU Data
         * Gets current ONU data from integration server via BackEnd
         */
        getCurrentOnuData: function () {
            var dataSend = {
                serial: self.editingOnu.serial
            };
            $.ajax({
                url: $rootScope.base_url + "/Onus/get_current_onu_data",
                type: "POST",
                data: dataSend,
                success: function (data) {
                    self.editingOnu.currentOnuData = data.data.response;
                    self.editingOnu.currentDataLoaded = true;
                    $rootScope.$apply();
                }
            });
        },

        /**
         * Confirm editing the onu with the given
         * data in parameter.
         * 
         * Expects onu object to contain database id
         * @param {edited onu} onu 
         */
        confirmOnuEdit: function (editingOnu) {
            var dataSend = {
                id: editingOnu.id,
                name: editingOnu.name
            };
            $.ajax({
                url: $rootScope.base_url + "/Onus/edit",
                type: "POST",
                data: dataSend,
                success: function (data) {
                    $rootScope.dialogService.close("onuConfig");
                }
            });
        },

        /**
         * Cancel onu editing, and reset to original name
         * @param {*} editingOnu 
         */
        cancelOnuEdit: function (editingOnu) {
            editingOnu.name = self.editingOnuOriginalName;
            $rootScope.dialogService.close("onuConfig");
        },


        /**
         * Chamado pelo intervalo de atualização dos dados
         * do dashboard. Limpa os dados atuais, e busca dados atualizados
         * do backend;
        */
        updateDashboardData: function () {
            self.dashboardData = {};
            self.dashboardDataLoading = true;
            $rootScope.isLoading = true;
            $rootScope.$apply();
            $.ajax({
                url: $rootScope.base_url + "/Onus/onu_dashboard_data",
                type: "POST",
                success: function (data) {
                    // Statistics
                    self.dashboardData.onusOnline = data.data.online_onus;
                    self.dashboardData.pctgOnusOnline = ((data.data.online_onus / data.data.total_onus) * 100).toFixed(1);
                    self.dashboardData.onusOffline = data.data.offline_onus;
                    self.dashboardData.pctgOnusOffline = ((data.data.offline_onus / data.data.total_onus) * 100).toFixed(1);
                    self.dashboardData.onusBadSignal = data.data.bad_signal_onus;
                    self.dashboardData.pctgOnusBadSignal = ((data.data.bad_signal_onus / data.data.total_onus) * 100).toFixed(1);
                    self.dashboardData.badSignalThreshold = data.data.signal_threshold;
                    self.dashboardData.unauthorizedOnus = data.data.unauthorized_onus;

                    // Get logs and make date readable
                    self.dashboardData.last_logs = data.data.last_logs;
                    for (let i = 0; i < self.dashboardData.last_logs.length; i++) {
                        const log = self.dashboardData.last_logs[i];
                        var datetime = new Date(log.date_created);
                        log.readable_date = self.getReadableDate(datetime);
                    }

                    self.dashboardDataLoading = false;
                    $rootScope.isLoading = false;

                    $rootScope.$apply();
                }
            });
        },

        /**
         * Get readable date based on datetime object
         * @param {*} datetime 
         */
        getReadableDate: function (datetime) {
            function pad(n) { return n < 10 ? "0" + n : n; }
            var readable_date = pad(datetime.getDate()) + "/" + pad(datetime.getMonth() + 1)
                + "/" + pad(datetime.getFullYear()) + " " + pad(datetime.getHours())
                + ":" + pad(datetime.getMinutes());
            return readable_date;
        },

        /** Opens the ONU list, and orders
         *  the list based on the parameter
         */
        dashboardShowOnuList(order) {
            self.showPage("Onus");

            if (order === "online") {
                $rootScope.ordenado = "onu_status";
                $rootScope.dirordenado = 0;
            } else if (order === "offline") {
                $rootScope.ordenado = "onu_status";
                $rootScope.dirordenado = 1;
            } else if (order === "bad_signal") {
                $rootScope.ordenado = "last_signal";
                $rootScope.dirordenado = 0;
            }
        },

        /**
         * Opens the Unauthorized ONUs list
         */
        dashboardShowUnauthorizedOnus() {
            self.showPage("UnauthorizedOnus");
        },

        /**
         * This method is fired in case the onus were loaded
         * after the clients. This looks through all onus, checks if
         * any client is owner of that onu, and in that case sets
         * the client color by redrawing its marker
         */
        setClientSignals: function () {
            if (!self.setSignalsOnClients || !$rootScope.onus || $rootScope.onus.length <= 0) {
                return;
            }
            // Go through all ONUs listed
            for (let i = 0; i < $rootScope.onus.length; i++) {
                var onu = $rootScope.onus[i];
                for (let j = 0; j < $rootScope.Clients.clients.length; j++) {
                    var client = $rootScope.Clients.clients[j];
                    // Look for client with this serial
                    if (client.serial_onu === onu.serial) {
                        if (client.last_signal !== onu.last_signal) {
                            // If it didn't have last_signal, redraw client
                            $rootScope.Clients.redrawClient(client.id);
                        }
                    }
                }
            }
            self.setSignalsOnClients = false;
        },

        // Open sidebar without specifying which page to show
        openSideBar: function () {
            // When opening sidebar, load all page contents from backend
            self.viewONUs();
            self.listOltTypes();
            self.listOlts();
            self.onusView();
        },

        onusView: function () {
            $x = $(".onusdiv").width();
            if ($x > $min) {
                // Change from wide sidebar to narrow sidebar
                $(".onusdiv").css("width", "1px");
                $(".btnONUs").css("transform", "scaleX(1)");
                self.wide_onus = false;
            } else {
                // expande a janela
                $(".onusdiv").css("width", "79%");
                $(".btnONUs").css("transform", "scaleX(-1)");
                self.wide_onus = true;
            }
            setTimeout(function () {
                $(window).trigger("resize");
            }, 100);
        },

        /**
         * List all olts
         */
        listOlts: function () {
            $rootScope.isLoading = true;
            $.ajax({
                url: $rootScope.base_url + "/olts/list_all",
                type: "GET",
                success: function (data) {
                    if (data) {
                        self.olts = data;
                        console.log(self.olts);
                        // pagination controls
                        $rootScope.currentPage = 1;
                        $rootScope.totalItems = self.olts.length;
                        $rootScope.entryLimit = Math.ceil($(".onusdiv").height() / 51); // items per page
                    }
                    $rootScope.isLoading = false;
                    $rootScope.$apply();
                }
            });
        },

        /**
 * List all olts
 */
        listOltTypes: function () {
            $rootScope.isLoading = true;
            $.ajax({
                url: $rootScope.base_url + "/olt_types/list_all",
                type: "GET",
                success: function (data) {
                    if (data) {
                        self.olt_types = data;
                    }
                    $rootScope.isLoading = false;
                    $rootScope.$apply();
                }
            });
        },

        /**
         * 
         */
        addOlt: function () {
            if (!self.verifyAddOltForm()) {
                self.message_error = $rootScope.Users.translateText("Por favor complete o formulário");
                $timeout(function () { self.message_error = null; }, 3000);
                return;
            }
            self.isLoading = true;

            var link = self.editing_olt ? $rootScope.base_url + "/olts/edit" : $rootScope.base_url + "/olts/add";
            $.ajax({
                url: link,
                type: "POST",
                data: $rootScope.form,
                success: function (response) {
                    if (response.status) {
                        self.editing_olt = false;
                        self.showPage("Olts");
                    } else {
                        self.message_error = response.message + " - " + (response.errors.ipv4 ? "OLT com este ipv4 já existe" : "");
                        $timeout(function () { self.message_error = null; }, 3000);
                    }
                    $rootScope.isLoading = false;
                    $rootScope.$apply();
                }
            });
        },

        /**
         * Verify correct completion of OLT Add form
         */
        verifyAddOltForm: function () {
            return true;
        },

        /**
         * Open add/edit page containing the current olt data
         * 
         */
        openEditOlt: function (olt_id) {
            // Find OLT to edit
            var oltEdit = null;
            for (let i = 0; i < self.olts.length; i++) {
                if (self.olts[i].id === olt_id) {
                    oltEdit = self.olts[i];
                }
            }
            if (oltEdit === null) {
                console.log("OLT not found");
                return;
            }

            // Set form
            $rootScope.form = oltEdit;
            self.editing_olt = true;

            // Open Add/Edit Page
            self.showPage("EditOlt");
        },

        deleteOlt: function (olt_id) {
            console.log("delete olt id = " + olt_id);
        },

        integrateOlt: function (olt, event) {
            // Show that its in progress
            btnElement = angular.element(event.target);
            btnElement.addClass("olt-integrate-button-in-progress");

            //Send event to analytics
			if ($rootScope.run_analytics) {
				ga("send", {
					hitType: "event",
					eventCategory: "IntegraOLT Actions",
					eventAction: "Set initial config on OLT",
					eventLabel: "Attempt to set initial config on OLT"
				});
			}

            // Send request to backend, to handle initial integration config
            $.ajax({
                url: $rootScope.base_url + "/olts/set_initial_config",
                data: { olt_id: olt.id },
                type: "POST",
                success: function (data) {
                    if (data.success) {
                        console.log("integrateOlt response: ", data);
                        olt.hardware_integrated = true;

                        //Send event to analytics
                        if ($rootScope.run_analytics) {
                            ga("send", {
                                hitType: "event",
                                eventCategory: "IntegraOLT Actions",
                                eventAction: "Set initial config on OLT - SUCCESS",
                                eventLabel: "Successfully set initial config on OLT"
                            });
                        }
                    } else {
                        //Send event to analytics
                        if ($rootScope.run_analytics) {
                            ga("send", {
                                hitType: "event",
                                eventCategory: "IntegraOLT Actions",
                                eventAction: "Set initial config on OLT - ERROR",
                                eventLabel: "Could not set initial config on OLT"
                            });
                        }
                    }
                },
                complete: function () {
                    btnElement.removeClass("olt-integrate-button-in-progress");
                    $rootScope.$apply();
                }
            });
        },

        showOltVlans: function (olt_id) {
            self.selectOlt(olt_id);
            self.showPage("Vlans");
        },

        listVlansNoTable: function () {
            if (self.selected_olt === null) {
                return;
            }
            $rootScope.isLoading = true;
            $.ajax({
                url: $rootScope.base_url + "/olts/list_vlans",
                data: { olt_id: self.selected_olt.id },
                type: "POST",
                success: function (data) {
                    if (data) {
                        self.olt_vlans = data;
                        console.log("listed vlans", self.olt_vlans);
                    }
                    $rootScope.isLoading = false;
                    $rootScope.$apply();
                }
            });
        },

        listVlans: function () {
            if (self.selected_olt === null) {
                return;
            }
            $rootScope.isLoading = true;
            $.ajax({
                url: $rootScope.base_url + "/olts/list_vlans",
                data: { olt_id: self.selected_olt.id },
                type: "POST",
                success: function (data) {
                    if (data) {
                        self.olt_vlans = data;
                        // pagination controls
                        $rootScope.currentPage = 1;
                        $rootScope.totalItems = self.olt_vlans.length;
                        $rootScope.entryLimit = Math.ceil($(".onusdiv").height() / 51); // items per page
                    }
                    $rootScope.isLoading = false;
                    $rootScope.$apply();
                }
            });
        },

        /**
         * ADD and EDIT VLANs
         */
        addVlan: function () {
            if (!$rootScope.form.vlan) {
                self.message_error = $rootScope.Users.translateText("Por favor complete o formulário");
                $timeout(function () { self.message_error = null; }, 3000);
                return;
            }
            $rootScope.form.olt_id = self.selected_olt.id;
            self.isLoading = true;
            var link = self.editing_vlan ? $rootScope.base_url + "/olts/edit_vlan" : $rootScope.base_url + "/olts/add_vlan";
            $.ajax({
                url: link,
                type: "POST",
                data: $rootScope.form,
                success: function (response) {
                    if (response.status) {
                        self.editing_vlan = false;
                        self.showPage("Vlans");
                    } else {
                        self.message_error = response.message;
                        $timeout(function () { self.message_error = null; }, 3000);
                    }
                    $rootScope.isLoading = false;
                    $rootScope.$apply();
                }
            });
        },

        /**
         * Open add/edit page containing the current olt data
         * 
         */
        openEditVlan: function (vlan_id) {
            // Find OLT to edit
            var vlanEdit = null;
            for (let i = 0; i < self.olt_vlans.length; i++) {
                if (self.olt_vlans[i].id === vlan_id) {
                    vlanEdit = self.olt_vlans[i];
                }
            }
            if (vlanEdit === null) {
                console.log("VLAN not found");
                return;
            }

            // Set form
            $rootScope.form = vlanEdit;
            self.editing_vlan = true;

            // Open Add/Edit Page
            self.showPage("EditVlan");
        },

        /**
         * 
         * @param {*} vlan_id 
         */
        deleteVlan: function (vlan_id) {
            self.isLoading = true;
            var link = $rootScope.base_url + "/olts/delete_vlan";
            $.ajax({
                url: link,
                type: "POST",
                data: { vlan_id: vlan_id },
                success: function (response) {
                    $rootScope.isLoading = false;
                    self.listVlans();
                    $rootScope.$apply();
                }
            });
        },

        selectOlt: function (olt_id) {
            for (let i = 0; i < self.olts.length; i++) {
                if (self.olts[i].id === olt_id) {
                    self.selected_olt = self.olts[i];
                }
            }
        },

        showOltPons: function (olt_id) {
            self.selectOlt(olt_id);
            self.showPage("Pons");
        },

        listPons: function () {
            if (self.selected_olt === null) {
                return;
            }
            $rootScope.isLoading = true;
            $.ajax({
                url: $rootScope.base_url + "/olts/list_pons",
                data: { olt_id: self.selected_olt.id },
                type: "POST",
                success: function (data) {
                    if (data) {
                        self.olt_pons = data;
                        // Transform default vlan id to string, to preselect option
                        $timeout(function () {
                            for (let j = 0; j < self.olt_pons.length; j++) {
                                var el = self.olt_pons[j];
                                console.log("pon:", el);
                                if (el.default_vlan_id) {
                                    el.default_vlan_id = el.default_vlan_id.toString();
                                }
                            }
                        }, 50);

                        // pagination controls
                        $rootScope.currentPage = 1;
                        $rootScope.totalItems = self.olt_pons.length;
                        $rootScope.entryLimit = Math.ceil($(".onusdiv").height() / 51); // items per page
                    }
                    $rootScope.isLoading = false;
                    $rootScope.$apply();
                }
            });
        },

        /**
         * 
         */
        savePonDefaultVlan: function (olt_pon) {
            console.log("EDIT DEFAULT VLAN");
            console.log(olt_pon);
            $.ajax({
                url: $rootScope.base_url + "/olts/edit_pon",
                data: olt_pon,
                type: "POST",
                success: function (response) {
                    if (response.status) {
                        console.log("success", response);
                    } else {
                        console.log("error", response);
                    }
                    $rootScope.isLoading = false;
                    $rootScope.$apply();
                }
            });
        },

        showOltUplinks: function (olt_id) {
            self.selectOlt(olt_id);
            self.showPage("UPLinks");
        },

        listUPLinks: function () {
            if (self.selected_olt === null) {
                return;
            }
            $rootScope.isLoading = true;
            $.ajax({
                url: $rootScope.base_url + "/olts/list_uplinks",
                data: { olt_id: self.selected_olt.id },
                type: "POST",
                success: function (data) {
                    if (data) {
                        self.olt_uplinks = data;
                        // Transform default vlan id to string, to preselect option
                        $timeout(function () {
                            for (let i = 0; i < self.olt_uplinks.length; i++) {
                                for (let j = 0; j < self.olt_uplinks[i].vlans.length; j++) {
                                    var el = self.olt_uplinks[i].vlans[j];
                                    el.id = el.id.toString();
                                }
                            }
                        }, 100);
                        // pagination controls
                        $rootScope.currentPage = 1;
                        $rootScope.totalItems = self.olt_uplinks.length;
                        $rootScope.entryLimit = Math.ceil($(".onusdiv").height() / 51); // items per page
                    }
                    $rootScope.isLoading = false;
                    $rootScope.$apply();
                }
            });
        },

        /**
         * 
         */
        addVlanToUplink: function (olt_uplink) {
            olt_uplink.vlans.push({ id: "" });
        },

        /**
         * 
         */
        removeVlanFromUplink: function (olt_uplink, index) {
            olt_uplink.vlans.splice(index, 1);
        },

        /**
         * 
         */
        saveUplinkVlans: function () {
            if (self.selected_olt === null) {
                return;
            }
            $rootScope.isLoading = true;
            var dataSend = {};
            dataSend.uplinks = self.olt_uplinks;

            dataSend.uplinks = self.cleanEmptyVlans(self.olt_uplinks);

            $.ajax({
                url: $rootScope.base_url + "/olts/update_uplink_vlans",
                data: dataSend,
                type: "POST",
                success: function (data) {
                    $rootScope.isLoading = false;
                    $rootScope.$apply();
                    self.listUPLinks();
                }
            });
        },

        /**
         * Go through all vlans in uplinks, and splice the ones that dont have an id
         */
        cleanEmptyVlans: function (olt_uplinks) {
            for (let i = 0; i < olt_uplinks.length; i++) {
                // Cleanup empty vlans
                for (let j = 0; j < olt_uplinks[i].vlans.length; j++) {
                    var el = olt_uplinks[i].vlans[j];
                    if (typeof el.id === "undefined" || el.id === null || el.id === "") {
                        olt_uplinks[i].vlans.splice(j, 1);
                    }
                }

                // Prevent comletely empty arrays from being removed from request:
                if (olt_uplinks[i].vlans.length <= 0) {
                    console.log("WILL PREVENT EMPTY STUFF");
                    console.log("before", olt_uplinks[i].vlans);
                    olt_uplinks[i].vlans = [""];
                    console.log("after", olt_uplinks[i].vlans);
                }
            }
            return olt_uplinks;
        },


    };

    $(".split-bar").mousedown(function (e) {
        e.preventDefault();
        $(document).mousemove(function (e) {
            e.preventDefault();
            $x = $(window).width() - e.pageX;
            // resize 
            $(".onusdiv").css("width", $x);
        });
    });

    $(document).mouseup(function (e) {
        $(document).unbind("mousemove");
        $x = $(".onusdiv").width();
        if ($x > $min) {
            self.wide_onus = true;
            //altera a flecha pra posicao correspondente
            $(".btnONUs").css("transform", "scaleX(-1)");
        } else {
            $(".btnONUs").css("transform", "scaleX(1)");
            self.wide_onus = false;
        }
        $rootScope.$apply();
    });

    return self;
});