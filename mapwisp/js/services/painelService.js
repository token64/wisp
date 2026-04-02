app.service("Painel", function ($rootScope, dialogService, $timeout) {


    var self = {
        isLoading: false,
        isLoadingLogs: false,
        isLoadingCommercialLogs: false,
        isLoadingDeployedClients: false,
        isLoadingAccessPointsSummary: false,

        logs: [],
        searchFilterLogs: [],
        paginationFilterLogs: [],
        logSearchTerm: "",
        logsPerPage: 5,
        currentLogsPage: 1,
        currentLogsPageStart: 1,
        currentLogsPageEnd: 5,

        commercialLogs: [],
        searchFilterCommercialLogs: [],
        paginationFilterCommercialLogs: [],
        commercialLogSearchTerm: "",
        commercialLogsPerPage: 5,
        currentCommercialLogsPage: 1,
        currentCommercialLogsPageStart: 1,
        currentCommercialLogsPageEnd: 5,

        company: [],
        show_only_deployeds_aps: null,
        accessPointsSummary: { total: 0, deployed: 0, undeployed: 0, by_category: [] },

        // Log time range dates
        logStartDate: null,
        logStartDateStr: "",
        logEndDate: null,
        logEndDateStr: "",
        commercialLogStartDate: null,
        commercialLogStartDateStr: "",
        commercialLogEndDate: null,
        commercialLogEndDateStr: "",

        /**
         * Initializes time ranges to load logs and commercial logs
         * Sets initial time ranges to the last 7 days
         */
        initTimeRanges: function () {
            self.logStartDate = new Date();
            self.logStartDate.setDate(self.logStartDate.getDate() - 7);
            self.logStartDateStr = self.getHtmlDateString(self.logStartDate);
            self.logEndDate = new Date();
            self.logEndDateStr = self.getHtmlDateString(self.logEndDate);

            self.commercialLogStartDate = new Date();
            self.commercialLogStartDate.setDate(self.commercialLogStartDate.getDate() - 7);
            self.commercialLogStartDateStr = self.getHtmlDateString(self.commercialLogStartDate);
            self.commercialLogEndDate = new Date();
            self.commercialLogEndDateStr = self.getHtmlDateString(self.commercialLogEndDate);
        },

        /**
         * Init Pagination
         * Initializes pagination select components for log and commercial log tables pagination
         */
        initPagination: function () {
            const logsPerPageSelectElement = document.querySelector("#log-page-select");
            const select = new mdc.select.MDCSelect(logsPerPageSelectElement);
            select.listen("MDCSelect:change", () => {
                self.logsPerPage = parseInt(select.value);
                self.updateLogsTableFilters();
            });

            const commercialLogsPerPageSelectElement = document.querySelector("#commercial-log-page-select");
            const commercialSelect = new mdc.select.MDCSelect(commercialLogsPerPageSelectElement);
            commercialSelect.listen("MDCSelect:change", () => {
                self.logsPerPage = parseInt(select.value);
                self.updateCommercialLogsTableFilters();
            });
        },

        list_logs: function () {
            $rootScope.ordenado = "message";
            $rootScope.dirordenado = 0;
            self.isLoading = true;
            self.isLoadingLogs = true;
            link = $rootScope.base_url + "/painel/list_all";
            $.ajax({
                url: link,
                type: "POST",
                success: function (data) {
                    self.company = data.company;
                    logs = [];
                    self.logs = [];
                    self.logs_comercial = [];
                    if (data.logs && data.logs.length > 0) {
                        angular.forEach(data.logs, function (val, index) {
                            if (val.commercial_user) {
                                self.logs_comercial.push(val);
                            } else {
                                self.logs.push(val);
                            }
                        });
                    }
                    $rootScope.currentPage = 1;
                    self.isLoading = false;
                },
                complete: function () {
                    self.isLoadingLogs = false;
                    $rootScope.$apply();
                }
            });

            $rootScope.ordenar = function (campo) {
                $rootScope.ordenado = campo;
                $rootScope.dirordenado = !$rootScope.dirordenado;
            };
        },

        /**
         * List all logs within given time range
         */
        listLogsNew: function () {
            self.isLoadingLogs = true;
            link = $rootScope.base_url + "/painel/list_logs";
            $.ajax({
                url: link,
                type: "POST",
                data: { start_date: self.logStartDateStr, end_date: self.logEndDateStr },
                success: function (data) {
                    self.logs = data.logs;
                    self.currentLogsPage = 1;
                    self.updateLogsTableFilters();
                },
                complete: function () {
                    self.isLoadingLogs = false;
                    $rootScope.$apply();
                }
            });
        },

        /**
         * Used for pagination and serch on logs table
         */
        updateLogsTableFilters: function () {
            if (self.logSearchTerm && self.logSearchTerm !== "") {
                self.searchFilterLogs = self.logs.filter(log => log.message.includes(self.logSearchTerm));
            } else {
                self.searchFilterLogs = self.logs.filter(log => true);
            }
            var start = (self.currentLogsPage - 1) * self.logsPerPage;
            self.currentLogsPageStart = start + 1;
            // End with minimum between start + logs per page or end of list (for last page)
            var end = Math.min((start + self.logsPerPage), self.searchFilterLogs.length);
            self.currentLogsPageEnd = end;
            self.paginationFilterLogs = self.searchFilterLogs.slice(start, end);
            $rootScope.$apply();
        },

        /** PAGINATION CONTROL FOR LOGS TABLE */
        logsPaginationFirst: function () {
            self.currentLogsPage = 1;
            self.updateLogsTableFilters();
        },
        logsPaginationPrevious: function () {
            if (self.currentLogsPage > 1) {
                self.currentLogsPage--;
                self.updateLogsTableFilters();
            }
        },
        logsPaginationNext: function () {
            if (self.currentLogsPage < self.searchFilterLogs.length / self.logsPerPage) {
                self.currentLogsPage++;
                self.updateLogsTableFilters();
            }
        },
        logsPaginationLast: function () {
            var intDivision = parseInt(self.searchFilterLogs.length / self.logsPerPage);
            var floatDivision = self.searchFilterLogs.length / self.logsPerPage;
            self.currentLogsPage = floatDivision > intDivision ? intDivision + 1 : intDivision;

            self.updateLogsTableFilters();
        },

        /**
        * List logs for commercial user within given time range
        */
        listCommercialUserLogs: function () {
            self.isLoadingCommercialLogs = true;
            link = $rootScope.base_url + "/painel/list_commercial_logs";
            $.ajax({
                url: link,
                type: "POST",
                data: { start_date: self.commercialLogStartDateStr, end_date: self.commercialLogEndDateStr },
                success: function (data) {
                    self.commercialLogs = data.commercial_logs;
                    self.currentCommercialLogsPage = 1;
                    self.updateCommercialLogsTableFilters();
                },
                complete: function () {
                    self.isLoadingCommercialLogs = false;
                    self.isLoading = false;
                    $rootScope.$apply();
                }
            });
        },
        /**
         * Used for pagination and serch on commercial logs table
         */
        updateCommercialLogsTableFilters: function () {
            if (self.commercialLogSearchTerm && self.commercialLogSearchTerm !== "") {
                self.searchFilterCommercialLogs = self.commercialLogs.filter(log => log.message.includes(self.commercialLogSearchTerm));
            } else {
                self.searchFilterCommercialLogs = self.commercialLogs.filter(log => true);
            }
            var start = (self.currentCommercialLogsPage - 1) * self.commercialLogsPerPage;
            self.currentCommercialLogsPageStart = start + 1;
            // End with minimum between start + logs per page or end of list (for last page)
            var end = Math.min((start + self.commercialLogsPerPage), self.searchFilterCommercialLogs.length);
            self.currentCommercialLogsPageEnd = end;
            self.paginationFilterCommercialLogs = self.searchFilterCommercialLogs.slice(start, end);
            $rootScope.$apply();
        },
        /** PAGINATION CONTROL FOR COMMERCIAL LOGS TABLE */
        commercialLogsPaginationFirst: function () {
            self.currentCommercialLogsPage = 1;
            self.updateCommercialLogsTableFilters();
        },
        commercialLogsPaginationPrevious: function () {
            if (self.currentCommercialLogsPage > 1) {
                self.currentCommercialLogsPage--;
                self.updateCommercialLogsTableFilters();
            }
        },
        commercialLogsPaginationNext: function () {
            if (self.currentCommercialLogsPage < self.searchFilterCommercialLogs.length / self.commercialLogsPerPage) {
                self.currentCommercialLogsPage++;
                self.updateCommercialLogsTableFilters();
            }
        },
        commercialLogsPaginationLast: function () {
            var intDivision = parseInt(self.searchFilterCommercialLogs.length / self.commercialLogsPerPage);
            var floatDivision = self.searchFilterCommercialLogs.length / self.commercialLogsPerPage;
            self.currentCommercialLogsPage = floatDivision > intDivision ? intDivision + 1 : intDivision;
            self.updateCommercialLogsTableFilters();
        },

        /**
         * Formats date to yyyy-mm-dd
         * @param {} date 
         */
        getHtmlDateString: function (date) {
            return date.getFullYear() + "-" +
                ((date.getMonth() + 1) < 10 ? "0" : "") +
                (date.getMonth() + 1) + "-" +
                (date.getDate() < 10 ? "0" : "") +
                date.getDate();
        },

        list_clients: function () {
            link = $rootScope.base_url + "/clients/last_deployed";
            $.ajax({
                url: link,
                type: "POST",
                data: { client_number: 5 },
                success: function (data) {
                    $rootScope.list_clients = data.data;
                },
                complete: function () {
                    $rootScope.$apply();
                }
            });
        },

        /**
         * Generates a line graph of client deployments
         */
        generateDeployedByWeekGraph: function (deployed_by_week) {
            const ctx = document.getElementById("myChart");
            new Chart(ctx, {
                type: "line",
                data: {
                    labels: deployed_by_week.map(week => week.week_range),
                    datasets: [{
                        label: $rootScope.Translation.translateText("Clientes Efetivados"),
                        data: deployed_by_week.map(week => week.deployments),
                        borderWidth: 2
                    }]
                },
                options: {
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    },
                    maintainAspectRatio: false,
                }
            });

        },

        list_clients_date: function () {
            self.isLoadingDeployedClients = true;
            link = $rootScope.base_url + "/clients/number_clients_deployed";
            $.ajax({
                url: link,
                type: "POST",
                success: function (data) {
                    $rootScope.clientesEfetivados = data.data;
                    self.generateDeployedByWeekGraph(data.data.deployed_by_week);
                },
                complete: function () {
                    self.isLoadingDeployedClients = false;
                    $rootScope.$apply();
                }
            });
        },

        get_company: function () {
            link = $rootScope.base_url + "/painel/get_company";
            $.ajax({
                url: link,
                type: "POST",
                success: function (data) {
                    self.company = data;
                    $rootScope.identifier = data;
                },
                complete: function () {
                    $rootScope.$apply();
                }
            });
        },

        /**
         * Get access points summary counts (total / deployed / undeployed)
         */
        getAccessPointsSummary: function () {
            self.isLoadingAccessPointsSummary = true;
            link = $rootScope.base_url + "/painel/access_points_summary";
            $.ajax({
                url: link,
                type: "POST",
                success: function (data) {
                    self.accessPointsSummary = Object.assign(
                        { total: 0, deployed: 0, undeployed: 0, by_category: [] },
                        data || {}
                    );
                },
                complete: function () {
                    self.isLoadingAccessPointsSummary = false;
                    $rootScope.$apply();
                }
            });
        },

        formContratoEmpresa: function () {
            var options = {
                autoOpen: false,
                modal: false,
                title: "Formulário de Contrato",
                width: 530,
                height: "auto",
                resizable: false,
                create: function (event, ui) {
                    $rootScope.form.error = [];
                    $(event.target).parent().css("position", "fixed");
                },
                close: function () {
                    $rootScope.tools = false;
                }
            };
            model = [];
            $rootScope.dialogService.open("contratoEmpresa", "contratoEmpresa", model, options).then();
        },

        set_error: function (error_var, message) {
            $rootScope.form.error[error_var] = message;
            $timeout(function () {
                $rootScope.form.error[error_var] = false;
            }, 2000);
        },

        verify_form: function () {
            var verified = true;
            //Nome
            if (!$rootScope.form.nome_responsavel || $rootScope.form.nome_responsavel == "") {
                self.set_error("nome_responsavel", "Insira o nome do responsável");
                verified = false;
            }
            //Razao Social
            if (!$rootScope.form.razao_social || $rootScope.form.razao_social == "") {
                self.set_error("razao_social", "Insira a Razao Social");
                verified = false;
            }
            //Email
            if (!$rootScope.form.email_cobranca || $rootScope.form.email_cobranca == "") {
                self.set_error("email_cobranca", "Insira o email");
                verified = false;
            }
            //Telefone
            if (!$rootScope.form.telefone_cobranca || $rootScope.form.telefone_cobranca == "") {
                self.set_error("telefone_cobranca", "Insira o telefone");
                verified = false;
            }
            //CNPJ
            if (!$rootScope.form.CNPJ || $rootScope.form.CNPJ == "") {
                self.set_error("CNPJ", "Insira o CNPJ");
                verified = false;
            } else if ($rootScope.form.CNPJ.length < 14) {
                self.set_error("CNPJ", "CNPJ incompleto");
                verified = false;
            }
            //CEP
            if (!$rootScope.form.cep || $rootScope.form.cep == "") {
                self.set_error("cep", "Insira o Endereço Completo");
                verified = false;
            }

            return verified;
        },

        contratoConfirm: function () {
            if (!self.verify_form()) {
                return;
            }
            console.log("Passou");

        },

        busca_cep: function () {
            self.isLoading = true;
            link = "https://viacep.com.br/ws/" + $rootScope.form.cep + "/json/";
            $.ajax({
                url: link,
                type: "GET",
                success: function (data) {
                    if (!data.error) {
                        $rootScope.form.rua = data.logradouro;
                        $rootScope.form.bairro = data.bairro;
                        $rootScope.form.cidade = data.localidade;
                        $rootScope.form.uf = data.uf;
                        $rootScope.$apply();
                    } else {
                        console.log("Error on busca_cep");
                    }
                    self.isLoading = false;
                },
                complete: function () {
                    self.isLoading = false;
                    $rootScope.$apply();
                }
            });
        }
    };

    return self;
});