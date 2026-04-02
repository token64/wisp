/**
 * Service with methods specific to the direct MAPWISP->OLT integration
 */
app.service("IntegraOlt", function ($rootScope) {

    var self = {

        form: {},
        error_message: "",
        state: {
            "loading": false,
            "showingSuccess": false,
            "showingError": false
        },

        integraOltIntegrated: false,

        /**
         * 
         */
        initialize: function(){
            console.log("CHECKING IF IS INTEGRAOLT INTEGRATED!");
            // Check if integraolt integration is active
            $.ajax({
				url: $rootScope.base_url + "/olts/is_integraolt_integrated",
				type: "GET",
				success: function (response) {
                    if (response.status) {
                        if (response.data["integraolt_integrated"]){
                            console.log("IS INTEGRAOLT INTEGRATED!");
                            self.integraOltIntegrated = true;
                        } else {
                            console.log("IS NOT INTEGRAOLT INTEGRATED!", response);
                        }
                    } else {
                        console.log("INTEGRAOLT REUEST ERROR!", response);
                    }
				},
                error: function (response) {
                    console.log("INTEGRAOLT REUEST ERROR!", response);
                }
			});
        },

    };

    return self;

});