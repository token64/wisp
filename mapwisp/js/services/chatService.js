app.service('Chat', function($rootScope){
	
	var self  = {

		initialize : function(){
			// noop
		},
		
		openWhatsApp : function(){
	    	window.open("https://wa.me/REPLACE_E164_SIN_SIGNOS", "_blank");
	    }  
	};

	return self;

})