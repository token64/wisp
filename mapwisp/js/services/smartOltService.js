app.service("SmartOlt", function ($rootScope) {

    var self = {

        form: {},
        error_message: "",
        state: {
            "loading": false,
            "showingSuccess": false,
            "showingError": false
        },

        smartOltIntegrated: false,

        /**
         * 
         */
        initialize: function(){
            // Check if smartolt integration is active
            $.ajax({
				url: $rootScope.base_url + "/smartolt/is_smartolt_integrated",
				type: "GET",
				success: function (data) {
					if (data["smartolt_integrated"]) {
						if (data.smartolt_integrated){
                            self.smartOltIntegrated = true;
                        } else {
                            // Not integrated
                        }
					}
				}
			});
        },

        clearForm : function(){
            self.form = {};
        },

        openSmartOltConfig : function(){

            // Open smartolt integration modal
            var options = {
                autoOpen: false,
                modal: false,
                title: $rootScope.Users.translateText("Integração com SMARTOLT"),
                width: 450,
                height:"auto",
            };
             model = [];
             $rootScope.dialogService.open("smartOltModal","smartOltModal", model, options).then();
        },

        /**
         * Inicia integração com SMARTOLT
         */
         startSmartOltIntegration : function(){
            // Collect integration data

            // 1 - Validate form - check if all form fields are present
            if (!self.form.api_url || !self.form.api_key){
                // ERROR
                self.setError($rootScope.Users.translateText("Por favor, preencha todos os campos"));
                return;
            }
            if (self.error_message !== ""){
                return;
            }

            // 2 - Send data to backend method
            var dataSend = {};
            dataSend = self.form;
            
            self.state.loading = true;
            
            $.ajax({
				url:  $rootScope.base_url+"/smartolt/start_integration",
                type: "POST",
				data: dataSend,
				success:function(response){
                    self.state.loading = false;
                    if (response.status) {
                        self.state.showingSuccess = true;
                        setTimeout(() => {
                            self.smartOltIntegrated = true;
                            self.state.showingSuccess = false;
                            $rootScope.$apply();
                            
                            // After showing success, close current modal, and open new modal to start syncronization
                            $rootScope.dialogService.close("smartOltModal");
                            self.startInitialSync();
                        }, 2500);

                        self.clearForm();
                        //Send event to analytics
                        if ($rootScope.run_analytics) {
                            ga("send", {
                                hitType: "event",
                                eventCategory: "SmartOlt",
                                eventAction: "start_integration",
                                eventLabel: "Started Integration with SmarOlt"
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
         * Sends request to start initial synchronization
         * and shows message on screen
         */
        startInitialSync: function(){
            $rootScope.alert_message("A sincronização inicial com SmartOLT foi iniciada no plano de fundo, isso pode levar alguns minutos. Você pode fechar esta janela, e poderá acessar os dados ativando o monitor.");
            $.ajax({
				url:  $rootScope.base_url+"/smartolt/initial_sync",
                type: "POST",
				data: dataSend,
				success:function(response){
                    if (response.status){
                        console.log("INITIAL SYNC RESPONSE:", response);
                        $rootScope.alert_message($rootScope.Users.translateText("Sincronização inicial com SmartOLT completa. Ative o modo monitor para acessar os dados."));
                    } else {
                        $rootScope.alert_message($rootScope.Users.translateText("Erro na sincronização inicial com SmartOLT."));
                    }
                },
                complete: function (response) {
                    $rootScope.$apply();
                }
            });
        },

        /**
         * 
         */
        stopSmartOltIntegration: function(){
            $.ajax({
				url:  $rootScope.base_url+"/smartolt/stop_integration",
                type: "POST",
				success:function(response){
                    if (response.status){
                        self.smartOltIntegrated = false;
                    }
                },
                complete: function (response) {
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

    };

    return self;

});