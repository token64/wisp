app.service("ErpIntegration", function ($rootScope) {

    var self = {

        integrationErps : {
            "1": "Synsuite"
        },

        integrationData : [],
        selectedErp: null,
        selectedErpId: null,
        form: {},
        error_message: "",
        test_message: "",
        state: {
            "loading": false,
            "showingSuccess": false,
            "showingError": false
        },
        syncLoading: false,
        syncConfirmLoading: false,
        completedSync: false,

        // SyncData stores the return from the backend function
        // "initial_sync", which checks for matches in items
        // in the TOMMODAT and ERP databases
        syncData: {},

        // Sync parameters are sent to the sync confirmation,
        // to inform the backend about which actions to take
        // during sync
        syncParameters: {
            ignore_already_integrated: true,
            add_erp_ctos: true,
            add_erp_olts: true,
            add_erp_splitters: true,
            add_tomodat_clients: true,
            add_tomodat_ctos: true,
            add_tomodat_ctos_type: true,
            add_tomodat_splitters: true,
            vinculate_clients: true,
            vinculate_ctos: true,
            vinculate_olts: true,
            vinculate_splitters: true
        },

        clearForm : function(){
            self.form = {};
        },

        openErpIntegrationTesting: function(){
           // GET all active possible integration ERPs
           $.ajax({
            url:  $rootScope.base_url+"/erpintegrations/get_active_erps",
            type: "GET",
            success:function(response){
                self.integrationErps = response;
                
                // Parse login fields JSON String
                self.integrationErps.forEach(erp => {
                    erp.login_fields = JSON.parse(erp.login_fields);
                });
            },
            complete: function(){
                $rootScope.$apply();
            }
        });

        // Open erp integration modal
        var options = {
            autoOpen: false,
            modal: false,
            title: $rootScope.Users.translateText("TESTES COM ERP INTEGRATION"),
            width: 450,
            height:"auto",
        };
         model = [];
         $rootScope.serialAdd = true;
         $rootScope.dialogService.open("erpIntegrationTestingModal","erpIntegrationTestingModal", model, options).then();
        },

        openErpIntegrationConfig : function(){
            // GET all active possible integration ERPs
            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/get_active_erps",
                type: "GET",
				success:function(response){
                    self.integrationErps = response;
                    
                    // Parse login fields JSON String
                    self.integrationErps.forEach(erp => {
                        erp.login_fields = JSON.parse(erp.login_fields);
                    });
                },
                complete: function(){
                    $rootScope.$apply();
                }
			});

            // Open erp integration modal
            var options = {
                autoOpen: false,
                modal: false,
                title: $rootScope.Users.translateText("ERP INTEGRATION"),
                width: 450,
                height:"auto",
            };
             model = [];
             $rootScope.serialAdd = true;
             $rootScope.dialogService.open("erpIntegrationModal","erpIntegrationModal", model, options).then();
        },

        /**
         * 
         */
        selectErp : function(){
            console.log("Selected ", self.selectedErp);
            self.integrationErps.forEach(erp => {
                if (erp.id == self.selectedErpId){
                    self.selectedErp = erp;
                }
            });
            console.log("Selected ", self.selectedErp);
        },

        /**
         * Get integration data of this MAPWISP account
         */
        getIntegrationData : function(){
            // Save integration data
            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/get_integration_data",
                type: "GET",
				success:function(response){
                    if (response.erp_integration_active){
                        self.integrationData["integrationActive"] = true;
                        self.integrationData["integratedErpName"] = response.erp_integration_name;
                        self.integrationData["integratedErpReference"] = response.erp_integration_reference;
                        self.integrationData["integrationAccessToken"] = response.erp_integration_access_token;
                    } else {
                        self.integrationData["integrationActive"] = false;
                    }
                },
                complete: function(){
                    $rootScope.$apply();
                }
			});
        },

        setError : function(error_text){
            self.error_message = error_text;
            clearTimeout(self.errorTimeout);
            self.errorTimeout = setTimeout(() => {
                self.error_message = "";
                $rootScope.$apply();
            }, 2000);
        },

        /**
         * Inicia integração com ERP
         */
        startErpIntegration : function(){
            // Collect integration data


            console.log("form: ", self.form);
            console.log(JSON.stringify(self.form));

            // 1 - Validate form - check if all form fields are present
            self.selectedErp.login_fields.forEach(login_field => {
                if (typeof self.form[login_field.field] === "undefined" || self.form[login_field.field] == null){
                    // ERROR
                    self.setError("Campo " + login_field.field_name + " precisa ser preenchido\n");
                    return;
                }
            });
            if (self.error_message !== ""){
                return;
            }

            // 2 - Send data to backend ERP_LOGIN method
            var dataSend = {};
            dataSend = self.form;
            dataSend.erp_reference = self.selectedErp.erp_reference;
            
            self.state.loading = true;
            
            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/start_integration",
                type: "POST",
				data: dataSend,
				success:function(response){
                    self.state.loading = false;
                    console.log(response);
                    if (response.status) {
                        self.state.showingSuccess = true;
                        setTimeout(() => {
                            self.state.showingSuccess = false;
                            $rootScope.$apply();
                            
                            // After showing success, close current modal, and open new modal to start syncronization
                            $rootScope.dialogService.close("erpIntegrationModal");
                            self.startSyncProcess();
                        }, 2500);

                        self.integrationData["integrationActive"] = response.data.erp_integration_active;
                        self.integrationData["integratedErpName"] = response.data.erp_integration_name;
                        self.integrationData["integratedErpReference"] = response.data.erp_integration_reference;
                        self.integrationData["integrationAccessToken"] = response.data.erp_integration_access_token;
                        self.clearForm();
                        //Send event to analytics
                        if ($rootScope.run_analytics) {
                            ga("send", {
                                hitType: "event",
                                eventCategory: "ErpIntegration",
                                eventAction: "start_integration",
                                eventLabel: "Started Integration with " + self.integrationData["integratedErpName"]
                            });
                        }
                    } else {
                        // Error
                        self.setError(response.message);
                    }
                },
                complete: function (response) {
                    $rootScope.$apply();
                }
            });
        },

        /**
         * Star ERP Synchronizatio Process
         * 
         * -- FOR SYNSUITE:
         * - Opens a modal to handle synchronization
         * - Makes ajax request asking for backend to match items between mapwisp and erp (initial_sync)
         * - When that ajax request returns, data is displayed in modal.
         * - User can than choose what should be synchronized and what shouldn't.
         * - When user confirms, self.confirmInitialSync function is called
         * 
         * -- FOR HUBSOFT:
         * - On HubSoft the synchronization doesnt have to be confirmed, so 
         * - the modal only shows the result of the sync process
         */
        startSyncProcess: function () {
            self.syncLoading = true;
            if (self.integrationData["integratedErpReference"] == "synsuite"){
                // Synsuite initial sync process
                self.synsuiteInitialSync();
            } else if (self.integrationData["integratedErpReference"] == "hubsoft"){
                // HubSoft initial sync process
                self.hubsoftInitialSync();
            }
        },

        /**
         * 
         */
        synsuiteInitialSync : function(){
            // Open initial syncronization modal
            var options = {
                autoOpen: false,
                modal: false,
                title: $rootScope.Users.translateText("SINCRONIZAÇÃO INICIAL"),
                width: 650,
                height: "auto",
                resizable:false,
                height: 600,
                close:function(){
                    // Clean state when closing modal
                    self.syncLoading = false;
                    self.syncConfirmLoading = false;
                    self.completedSync = false;  
                },
            };
            model = [];
            $rootScope.serialAdd = true;
            $rootScope.dialogService.open("erpIntegrationSync", "erpIntegrationSync", model, options).then();

            // Send AJAX to backend
            $.ajax({
                url:  $rootScope.base_url+"/erpintegrations/initial_sync",
                type: "GET",
                success:function(response){
                    self.syncData = response.data;
                    self.updateSyncParameters();
                },
                error: function(response){
                    console.log("ERROR INITIAL SYNC:", response);
                },
                complete: function (response) {
                    self.syncLoading = false;
                    $rootScope.$apply();
                }
            });
        },

        /**
         * 
         */
        hubsoftInitialSync : function(){
            // Open initial syncronization modal
            var options = {
                autoOpen: false,
                modal: false,
                title: $rootScope.Users.translateText("SINCRONIZAÇÃO INICIAL HUBSOFT"),
                width: 650,
                height: "auto",
                resizable:false,
                height: 600,
                close:function(){
                    // Clean state when closing modal
                    self.syncLoading = false;
                    self.syncConfirmLoading = false;
                    self.completedSync = false;  
                },
            };
            model = [];
            $rootScope.serialAdd = true;
            $rootScope.dialogService.open("hubsoftIntegrationSync", "hubsoftIntegrationSync", model, options).then();

            // Send AJAX to backend
            $.ajax({
                url:  $rootScope.base_url+"/erpintegrations/initial_sync",
                type: "GET",
                success:function(response){
                    self.completedSync = true;
                    self.syncData = response.data;
                    if (response.status){
                        console.log("SUCCESS");
                    } else {
                        console.log("ERROR");
                    }
                },
                error: function(response){
                    console.log("ERROR INITIAL SYNC:", response);
                },
                complete: function (response) {
                    self.syncLoading = false;
                    $rootScope.$apply();
                }
            });
        },

        /**
         * When the synchronization data is returned (containing matching items,
         * items to be added to mapwisp and synsuite), this function updates the
         * parameters that will be sent to the confirmSync method on the server.
         * If the olt matches array is empty, for instance, the vinculate_olts
         * flag should be false.
         */
        updateSyncParameters : function(){
            // OLTs
            if (self.syncData.olts.match.length <= 0){
                self.syncParameters.vinculate_olts = false;
            }
            if (self.syncData.olts.add_synsuite.length <= 0){
                self.syncParameters.add_erp_olts = false;
            }
            
            // CTOs
            if (self.syncData.ctos.match.length <= 0){
                self.syncParameters.vinculate_ctos = false;
            }
            if (self.syncData.ctos.add_synsuite.length <= 0){
                self.syncParameters.add_erp_ctos = false;
            }
            if (self.syncData.ctos.add_tomodat.length <= 0){
                self.syncParameters.add_tomodat_ctos = false;
            }

            // Splitters
            if (self.syncData.splitters.match.length <= 0){
                self.syncParameters.vinculate_splitters = false;
            }
            if (self.syncData.splitters.add_synsuite.length <= 0){
                self.syncParameters.add_erp_splitters = false;
            }
            if (self.syncData.splitters.add_tomodat.length <= 0){
                self.syncParameters.add_tomodat_splitters = false;
            }

            // Clients
            if (self.syncData.client_connections.match.length <= 0){
                self.syncParameters.vinculate_clients = false;
            }
            if (self.syncData.client_connections.add_tomodat.length <= 0){
                self.syncParameters.add_tomodat_clients = false;
            }
        },

        /**
         * Confirm Initial Sync Function
         * 
         * - After user checks which synchronizations should happen and confirms,
         * this method is called. 
         * - An ajax request is sent with the parameters the user has set.
         * - Entire actual sync process happens in backend during this request.
         */
        confirmInitialSync : function(){
            self.syncConfirmLoading = true;
            var dataSend = {
                parameters: self.syncParameters
            };
            // Send AJAX to backend
            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/confirm_initial_sync",
                type: "POST",
                data: dataSend,
				success:function(response){
                    console.log(response);
                },
                complete: function (response) {
                    self.syncConfirmLoading = false;
                    self.completedSync = true;
                    $rootScope.$apply();
                }
            });
        },

        /**
         * Cancela integração com ERP atual
         * Anula variáveis pertinentes à integração na tabela companies
         */
        endErpIntegration : function(){
            var erpName = self.integrationData["integratedErpName"];
            // Save integration data
            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/end_integration",
                type: "POST",
                success: function (response) {
                    if (response.status) {
                        self.integrationData["integrationActive"] = response.data.erp_integration_active;
                        self.integrationData["integratedErpName"] = response.data.erp_integration_name;
                        self.integrationData["integratedErpReference"] = response.data.erp_integration_reference;
                        self.integrationData["integrationAccessToken"] = response.data.erp_integration_access_token;

                        self.clearForm();
                        //Send event to analytics
                        if ($rootScope.run_analytics) {
                            ga("send", {
                                hitType: "event",
                                eventCategory: "ErpIntegration",
                                eventAction: "end_integration",
                                eventLabel: "Ended Integration with " + erpName
                            });
                        }
                    } else {
                        // Error
                        self.setError(response.message);
                    }


                },
                complete:function(){
                    $rootScope.$apply();
                }
			});
        },

        /**
         * Get readable date based on datetime object
         * @param {*} datetime 
         */
        getReadableDate: function(datetime){
            function pad(n){return n<10 ? "0"+n : n;}
            var readable_date = pad(datetime.getDate()) + "/" + pad(datetime.getMonth() + 1) 
                        + "/" + pad(datetime.getFullYear()) + " " + pad(datetime.getHours())
                        + ":" + pad(datetime.getMinutes())
                        + ":" + pad(datetime.getSeconds());
            return readable_date;
        },

        /**
         * Get ErpSyncLogs from backend, and show them in new dialog
         */
        showErpSyncLogs : function(){
            // Send request to get sync logs
            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/get_erp_sync_logs",
                type: "GET",
				success:function(response){
                    console.log(response);
                    self.erpSyncLogsList = response;

                    // Convert datetime from MySQL to JS
                    self.erpSyncLogsList.forEach(log => {
                        var dateStarted = new Date(log.date_started);
                        log.date_started_js = dateStarted;
                        log.date_started_str = self.getReadableDate(dateStarted);
                        log.date_finished_js = new Date(log.date_finished);
                        log.time_spent = (log.date_finished_js.getTime() - log.date_started_js.getTime()) / 1000;

                        // Details Object
                        log.result_details_object = JSON.parse(log.result_details);
                        log.translated_details_obj = self.getHubsoftResultDetails(log.result_details_object);

                        // Render JSON only after timeout, to ensure HTML is created before
                        setTimeout(function(){
                            renderjson.set_show_to_level(0);
                            document.getElementById("erp-sync-log-result-json-" + log.id).appendChild(
                                renderjson(log.translated_details_obj)
                            );
                        },200);
                    });
                },
                complete: function (response) {
                    $rootScope.$apply();
                }
            });

            // Open Dialog to Show ERP Sync logs
			var options = {
				autoOpen: false,
				modal: true,
				title: $rootScope.Users.translateText("Logs de sincronização com ERP"),
                width: 700,
                height: "auto",
				maxHeight: 500,
				resizable:true,
				close: function(){
                    //-
				}
			};
			model = [];
			$rootScope.dialogService.open("erpSyncLogs","erpSyncLogs", model, options).then();
        },

        /**
         * 
         * @param {*} resultDetailsObj 
         * @return {*} translated object
         */
        getHubsoftResultDetails : function(resultDetailsObj){
            var translatedDetailsObj = {};
            translatedDetailsObj.sucesso = resultDetailsObj.sync_success;
            translatedDetailsObj.clientes_encontrados_erp = resultDetailsObj.total_loaded_clients_erp;
            translatedDetailsObj.numero_clientes_criados = resultDetailsObj.create_success;

            if (resultDetailsObj.create_error > 0){
                translatedDetailsObj.numero_clientes_erro_criando = resultDetailsObj.create_error;
            }

            if (resultDetailsObj.vinculate_success > 0){
                translatedDetailsObj.numero_clientes_vinculados = resultDetailsObj.vinculate_success;
            }

            if (resultDetailsObj.vinculate_error > 0){
                translatedDetailsObj.numero_erro_vinculando = resultDetailsObj.vinculate_error;
            }

            if (resultDetailsObj.already_vinculated > 0){
                translatedDetailsObj.clientes_ja_integrados = resultDetailsObj.already_vinculated;
            }
            translatedDetailsObj.erros_criando_clientes = resultDetailsObj.error_information;
            return translatedDetailsObj;
        },

        // SOMENTE PARA FINS DE TESTE NA MODAL DE TESTES
        setTestMessage : function(test_text){
            self.test_message = test_text;
            clearTimeout(self.testMessageTimeout);
            self.testMessageTimeout = setTimeout(() => {
                self.test_message = "";
                $rootScope.$apply();
            }, 5000);
        },

        // Listagem OLTs
        oltList : function(){
            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/olt_list",
                type: "GET",
				success:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                complete: function (response) {
                    $rootScope.$apply();
                }
            });
        },


        // Listagem Splitters
        splitterList : function(){
            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/splitter_list",
                type: "GET",
				success:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                complete: function (response) {
                    $rootScope.$apply();
                }
            });
        },

        // Add Splitter
        splitterAdd : function(){

            var dataSend = {};

            dataSend.code = 12313;
            // dataSend.networkBoxIntegrationCode = 12311;
            dataSend.integrationCode = 12313;
            dataSend.type = 1;
            dataSend.title = "Splitter Teste Mapwisp 5";
            dataSend.description = "Descrição do Splitter Teste Mapwisp 5";
            dataSend.outPorts = 8;

            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/splitter_add",
                type: "POST",
                data: dataSend,
				success:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
				error:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                complete: function (response) {
                    $rootScope.$apply();
                }
            });
        },

        // Edit Splitter
        splitterEdit : function(){

            var dataSend = {};

            dataSend.code = 1231;
            dataSend.title = "Splitter Teste Edit Mapwisp";

            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/splitter_edit",
                type: "PUT",
                data: dataSend,
				success:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
				error:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                complete: function (response) {
                    $rootScope.$apply();
                }
            });
        },

        // Deletar Splitter
        splitterDelete : function(){

            var dataSend = {};

            dataSend.code = 1231;

            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/splitter_delete",
                type: "DELETE",
                data: dataSend,
				success:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
				error:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                complete: function (response) {
                    $rootScope.$apply();
                }
            });
        },
        
        // Vincular Splitter
        splitterSetIntegrationCode : function(){

            var dataSend = {};

            dataSend.code = "7777334";
            dataSend.idSynsuite = "1712";

            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/splitter_setIntegrationCode",
                type: "PUT",
                data: dataSend,
				success:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
				error:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                complete: function (response) {
                    $rootScope.$apply();
                }
            });
        },

        // Vincular Splitter na CTO
        splitterSetCTO : function(){

            var dataSend = {};

            dataSend.codeSplitter = "12313";
            dataSend.codeCTO = "19999";

            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/splitter_setCTO",
                type: "PUT",
                data: dataSend,
				success:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
				error:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                complete: function (response) {
                    $rootScope.$apply();
                }
            });
        },

        // Vincular Splitter na CTO by Id
        splitterSetCTOById : function(){

            var dataSend = {};

            dataSend.idSplitter = "1722";
            dataSend.idCTO = "3088";

            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/splitter_setCTOById",
                type: "PUT",
                data: dataSend,
				success:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
				error:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                complete: function (response) {
                    $rootScope.$apply();
                }
            });
        },

        // Listagem Connections
        connectionList : function(){
            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/connection_list",
				//url:  $rootScope.base_url+"/erpintegrations/splitter_list",
                type: "GET",
				success:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");

                    var clientWithSplitterAndIntegrationCode = 0;
                    var clientWithSplitterNoIntegrationCode = 0;
                    var clientWithoutSplitter = 0;
                    response.data.forEach(connection => {
                        if (connection.splitter){
                            if (connection.splitter.integrationCode){
                                console.log("conn with splitter that has integration Code!:");
                                console.log(connection);
                                console.log("===============");
                                clientWithSplitterAndIntegrationCode += 1;
                            } else {
                                console.log("conn with splitter no integration code:");
                                console.log(connection);
                                console.log("===============");
                                clientWithSplitterNoIntegrationCode += 1;
                            }
                        } else {
                            clientWithoutSplitter += 1;
                        }
                    });

                    console.log("Clients without splitter:", clientWithoutSplitter);
                    console.log("Clients with splitter, no int code:", clientWithSplitterNoIntegrationCode);
                    console.log("Clients with splitter AND int code:", clientWithSplitterAndIntegrationCode);
                },
                error:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                complete: function (response) {
                    $rootScope.$apply();
                }
            });
        },

        // Buscar Conexoes
        connectionSearch : function(){

            var dataSend = {};
            dataSend.protocol = self.form;
            dataSend.clientid = self.selectedErp.erp_reference;

            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/connection_search",
                type: "GET",
                data: dataSend,
				success:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                error:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                complete: function (response) {
                    $rootScope.$apply();
                }
            });
        },
        
        // Vincular
        connectionSetIntegrationCode : function(){

            var dataSend = {};
            dataSend.idSynsuite = 20362;
            dataSend.codIntCon = 11222;

            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/connection_setIntegrationCode",
                type: "PUT",
                data: dataSend,
				success:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                error:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                complete: function (response) {
                    $rootScope.$apply();
                }
            });
        },

        // Vincular Reserva
        connectionSetIntegrationCodeRes : function(){

            var dataSend = {};
            dataSend.resIdSplitter = 18;
            dataSend.resIdPort = 1874;

            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/connection_setIntegrationCodeRes",
                type: "PUT",
                data: dataSend,
				success:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                error:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                complete: function (response) {
                    $rootScope.$apply();
                }
            });
        },

        // Atualiza splitter/porta
        connectionUpdateSplitterPort : function(){

            var dataSend = {};
            dataSend.connectionIntegrationCode = 11222;    //Código de integração da conexão
            dataSend.oltIntegrationCode = 1;   //Código de integração da OLT do Splitter
            dataSend.splitterIntegrationCode = 12313;  //Código de integração do splitter
            dataSend.port = 1874;

            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/connection_updateSplitterPort",
                type: "PUT",
                data: dataSend,
				success:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                error:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                complete: function (response) {
                    $rootScope.$apply();
                }
            });
        },

        // Atualiza integration code
        connectionUpdateIntegrationCode : function(){

            var dataSend = {};
            dataSend.oldIntegrationCode = 11222;
            dataSend.newIntegrationCode = 11223;

            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/connection_updateIntegrationCode",
                type: "PUT",
                data: dataSend,
				success:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                error:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                complete: function (response) {
                    $rootScope.$apply();
                }
            });
        },
        
        // Criar OLT
        oltAdd : function(){
            var dataSend = {};

            dataSend.code = "1115";
            dataSend.title = "OLT Teste Mapwisp5";
            dataSend.description = "Descrição da OLT Teste Mapwisp5";
            dataSend.slotsNumber = 1;
            dataSend.portsNumber = 4;
            dataSend.portsFirstNumber = 0;
            dataSend.active = true;
            dataSend.integrationCodeMap = 1234;
            dataSend.postalCode = "97050-220";
            dataSend.street = "Rua Francisco Crossetti";
            dataSend.streetNumber = "369";
            dataSend.neighborhood = "Nossa Senhora de Lourdes";
            dataSend.city = "Santa Maria";
            dataSend.uf = "RS";
            dataSend.lat = "-29.696061";
            dataSend.lng = "-53.7906175";

            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/olt_add",
                type: "POST",
                data: dataSend,
				success:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                error: function (response) {
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                complete: function (response) {
                    $rootScope.$apply();
                }
            });
        },

        // Edita OLT
        oltEdit : function(){
            
            var dataSend = {};
            
            dataSend.code = "1232";
            //OBS: Informar somente os campos que serão atualizados.            
            dataSend.description = "Alterando Descrição da OLT Teste Mapwisp3";
            

            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/olt_edit",
                type: "PUT",
                data: dataSend,
				success:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                error: function (response) {
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                complete: function (response) {
                    $rootScope.$apply();
                }
            });
        },

        // Edita OLT
        oltDelete : function(){
            
            var dataSend = {};
            
            dataSend.code = "1231";

            //Deleta uma OLT específica por integrationCode
            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/olt_delete",
                type: "DELETE",
                data: dataSend,
				success:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                error: function (response) {
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                complete: function (response) {
                    $rootScope.$apply();
                }
            });
        },

        // Vincula OLT
        oltSetIntegrationCode : function(){
            
            var dataSend = {};
            
            dataSend.code = "1112";
            dataSend.idSynsuite = "1006";

            //Vincula o código de integração em um registro do Synsuite.
            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/olt_setIntegrationCode",
                type: "PUT",
                data: dataSend,
				success:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                error: function (response) {
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                complete: function (response) {
                    $rootScope.$apply();
                }
            });
        },
        
        /**
         * FUNÇÕES PARA MANIPULAÇÃO DE CTOS NO SYNSUITE
         */
        // Listagem CTOs
        ctoList : function(){
            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/cto_list",
                type: "GET",
				success:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                complete: function (response) {
                    $rootScope.$apply();
                }
            });
        },

        // Nova CTO
        ctoAdd : function(){

            var dataSend = {};
            
            dataSend.code = "123.1";
            dataSend.title = "CTO Teste Mapwisp";
            dataSend.active = true;
            dataSend.status = 1;
            dataSend.type = 1;
            dataSend.integrationCode = 123.1;
            dataSend.networkBoxAddress = {
                postalCode: "97050-220",
                city: "Santa Maria",
                street: "Rua Francisco Crossetti",
                number: "369",
                neighborhood: "Nossa Senhora de Lourdes",
                state: "RS",
                latitude: "-29.698061",
                longitude: "-53.7936175",
                addressComplement: "Complemento",
                addressReference: "Referencia"
            };
            

            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/cto_add",
                type: "POST",
                data: dataSend,
				success:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
				error:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                complete: function (response) {
                    $rootScope.$apply();
                }
            });
        },

        // Editar CTO
        ctoEdit : function(){

            var dataSend = {};
            
            dataSend.code = "123.1";
            dataSend.title = "Teste editar cto";

            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/cto_edit",
                type: "PUT",
                data: dataSend,
				success:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
				error:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                complete: function (response) {
                    $rootScope.$apply();
                }
            });
        },

        // Editar Endereço CTO
        ctoEditAddress : function(){

            var dataSend = {};
            
            dataSend.code = "123.1";
            
            dataSend.postalCode = "97050-220";
            dataSend.city = "Santa Maria";
            dataSend.street = "teste edit Rua Francisco Crossetti";
            dataSend.number = "369";
            dataSend.neighborhood = "Nossa Senhora de Lourdes";
            dataSend.state = "RS";
            dataSend.latitude = "-29.698061";
            dataSend.longitude = "-53.7936175";
            dataSend.addressComplement = "Complemento";
            dataSend.addressReference = "Referencia";

            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/cto_edit_address",
                type: "PUT",
                data: dataSend,
				success:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
				error:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                complete: function (response) {
                    $rootScope.$apply();
                }
            });
        },

        // Editar Endereço CTO
        ctoDelete : function(){

            var dataSend = {};
            
            dataSend.code = "123.1";

            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/cto_delete",
                type: "DELETE",
                data: dataSend,
				success:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
				error:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                complete: function (response) {
                    $rootScope.$apply();
                }
            });
        },

        // Editar Endereço CTO
        ctoSetIntegrationCode : function(){

            var dataSend = {};
            
            dataSend.code = "123.1";
            dataSend.idSynsuite = "123";

            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/cto_setIntegrationCode",
                type: "PUT",
                data: dataSend,
				success:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
				error:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                complete: function (response) {
                    $rootScope.$apply();
                }
            });
        },
        // --- FIM CTOS

        /**
         * FUNÇÕES PARA MANIPULAÇÃO DE REGIÕES NO SYNSUITE
         */
        // Listagem REGIÕES
        regionList : function(){
            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/region_list",
                type: "GET",
				success:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                complete: function (response) {
                    $rootScope.$apply();
                }
            });
        },

        // Adicionar região
        regionAdd : function(){

            var dataSend = {};
            
            dataSend.code = 6;
            dataSend.title = "Teste Mapwisp 2";
            dataSend.description = "Teste Mapwisp 2";
            // dataSend.integrationCode = 5;
            dataSend.active = true;

            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/region_add",
                type: "POST",
                data: dataSend,
				success:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                error:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                complete: function (response) {
                    $rootScope.$apply();
                }
            });
        },

        // Editar região
        regionEdit : function(){

            var dataSend = {};
            
            dataSend.code = 7;
            dataSend.title = "Teste Edit Mapwisp 2";
            dataSend.description = "Teste Edit Mapwisp 2";
            dataSend.integrationCode = 5;
            dataSend.active = true;

            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/region_edit",
                type: "PUT",
                data: dataSend,
				success:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                error:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                complete: function (response) {
                    $rootScope.$apply();
                }
            });
        },

        // Deletar região
        regionDelete : function(){

            var dataSend = {};
            
            dataSend.integrationCode = 5;

            $.ajax({
				url:  $rootScope.base_url+"/erpintegrations/region_delete",
                type: "DELETE",
                data: dataSend,
				success:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                error:function(response){
                    console.log(response);
                    self.setTestMessage("Retorno com status: " + response.status  + ". Detalhes no console");
                },
                complete: function (response) {
                    $rootScope.$apply();
                }
            });
        },
        // --- FIM REGIÕES

    };

    return self;

});