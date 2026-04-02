app.service('Ruler', function($rootScope,dialogService){
	
	var self  = {
	 	started : false,

	 	start : function(){
	 		if(self.started){
	  			self.adding = false;
	            self.finish();
	        }else{
	        	var options = {
	        		autoOpen: false,
	        		modal: false,
	        		title: $rootScope.Users.translateText('Ferramenta régua'),
	        		width: 352,
	        		height:'auto',
	        		resizable:false,
	        		dialogClass: "noclose", 
	        		dialogClass: "noclose no-scroll", 
	        		position: {
	        			my: "right top",
	        			at: "right-10 top+80",
	        			of: window,
	        			collision: "none"
	        		},
	        		create: function (event, ui) {
	        			$(event.target).parent().css('position', 'fixed');
	        		},
	        		close:function(){
	        			self.finish();
	        		}
	        	};
	        	model = [];  
	        	$rootScope.dotsCount = 0;
	        	self.started = true;
	        	dialogService.open('rulerView','rulerView', model, options).then();
	        }
	 	},

	 	finish : function(){
	 		if($rootScope.dotsCount>0){
				angular.forEach($rootScope.dotsTemp,function(val,index){
					val.setMap(null);
				});
				$rootScope.cableTemp.setMap(null);
			}
			$rootScope.tempPath = [];
			$rootScope.dotsTemp = [];
			$rootScope.cableTemp = [];
			$rootScope.dotsCount = 0;
			$rootScope.metersCount = 0;
			$rootScope.form = [];
			$rootScope.form.error = [];
			dialogService.close('rulerView');
			self.started = false;
	 	}


	}

	return self;

})