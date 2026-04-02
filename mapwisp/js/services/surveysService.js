/**
 * This service contains methods and data to help
 * manage surveys that we want to show the end users.
 */
app.service("Surveys", function (dialogService,$rootScope,$timeout,$interval,Functions,LevelsAndModes, Tour, Users) {

    var self = {

        showSurveyContent: true,
        showSurveySending: false,
        showSurveySuccess: false,

        currentSurvey: null,

        /**
         * Check if there are active surveys for this user,
         * and show any active survey
         */
        showActiveSurvey : function(){
            if (LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR])){
                // Check if there is a survey for this admin user
                activeSurvey = self.checkActiveSurvey();
                if (!activeSurvey){
                    return;
                } 
                self.showSurveyPopup(activeSurvey);
            } 
            // else { // No surveys for non-admins yet }
        },

        /**
         * Checks if there is any active survey that should
         * ne shown to the current user
         */
        checkActiveSurvey: function(){
            // Set user as online right now
            var activeSurvey = false;
            $.ajax({
                url:  $rootScope.base_url+"/surveys/get_any_active_survey",
                type: "POST",
                async: false,
                success:function(data){
                    if (data.any_active_survey){
                        activeSurvey = data.survey_data;
                    }
                }
            });
            return activeSurvey;
        },

        /**
         * Shows the specific popup for a survey,
         * based on the given survey data
         * 
         * @param {*} activeSurvey 
         */
        showSurveyPopup: function(activeSurvey){
            if (activeSurvey.name == "OltSurvey"){
                self.currentSurvey = activeSurvey;
                self.showOltSurvey();
                //Send event to analytics
                if ($rootScope.run_analytics){
                    ga("send", {
                        hitType: "event",
                        eventCategory: "Surveys",
                        eventAction: "survey_popup_shown",
                        eventLabel: "OltSurvey"
                    });
                }
            }
        },

        /**
         * Specific method to show the pop up for 
         * the OLT Survey 
         */
        showOltSurvey: function(){
            // Open Modal
            var options = {
                autoOpen: false,
                modal: true,
                title: $rootScope.Users.translateText("Pesquisa - Integração com OLTs"),
                width: 600,
                height: 500,
                resizable: false,
            };
            model = [];
            $rootScope.dialogService.open("olt-poll-popup", "olt-poll-popup", model, options).then(function() {
                $("#select-olt-type").select2({
                    width: "100%",
                    placeholder: $rootScope.Users.translateText("Selecione todos os tipos de OLT que usa")
                });
            });
        },


        oltTypesSelect: [],
        oltNumbers: 1,
        /**
         * OLT Survey Answer
         */
        oltSurveyAnswer : function(isInterested){
            self.showSurveyContent = false;
            self.showSurveySending = true;

            surveyData = {
                survey_id: self.currentSurvey.id,
                survey_name: self.currentSurvey.name,
                surveyAnswer: {
                    isInterested: isInterested,
                    oltNumber: self.oltNumbers,
                    oltTypes: self.oltTypesSelect
                }
            };

            $.ajax({
                url:  $rootScope.base_url+"/surveys/answer",
                type: "POST",
                data: surveyData,
                success:function(data){
                    if (data.any_active_survey){
                        activeSurvey = data.survey_data;
                    }
                },
                complete:function(){
                    self.showSurveyContent = false;
                    self.showSurveySending = false;
                    self.showSurveySuccess = true;
                    $rootScope.$apply();
                    // Close after timeout
                    setTimeout(() => {
                        $rootScope.dialogService.close("olt-poll-popup");
                        $rootScope.$apply();
                    }, 1000);

                    //Send event to analytics
                    if ($rootScope.run_analytics){
                        ga("send", {
                            hitType: "event",
                            eventCategory: "Surveys",
                            eventAction: "survey_answered",
                            eventLabel: "OltSurvey"
                        });
                    }
                }
            });
        },

    };

    return self;
     
});