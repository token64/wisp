
app.service('Locations', function($rootScope,Map,$q,dialogService){



	var self = {
		'isLoading' : false,
		'locations' : [],
		'fullLocationsBar' : false,

		defaultLocationSet: false,

		locationList :  function(center){
			self.isLoading = true;
			var locationsNames = "";
			var d = $q.defer();
			link = $rootScope.base_url+'/locations/list_all'			
			$.ajax({
				url: link,
				type: 'POST',
				success:function(data){
					self.locations = data;
					self.isLoading = false;
					if(data.length > 0){
						if(center){
							angular.forEach(data,function(val,index){
								if(val.default){
									Map.setCenter(val.dot.lat,val.dot.lng,val.zoom); 
									self.defaultLocationSet = true;
								}
								locationsNames += val.name;
								// Antes, quando a barra de localidades enchia, exibia as excedentes no dropdown
								// Comentando essa parte, todas as localidades vão para o dropdown
								// if(locationsNames.length > 80){
									val.fullLocationsBar = true;
									self.fullLocationsBar = true;
								// }else{
								// 	val.fullLocationsBar = false;
								// }       
							});
						}	 
						d.resolve();
					}	            
				}
			})
			return d.promise;
		},


		setDefault : function(id){
			self.isLoading = true;
			link = $rootScope.base_url+'/locations/edit';
			$.ajax({
				url: link,
				type: 'POST',
				data:{id:id,default:1},
				success:function(data){
					self.isLoading = false;
					if(data.status == 1){
						self.locationList();  
					}
					$rootScope.set_message(data);
				}				
			})
		},

		deleteConfirm : function(id){
			self.isLoading = true;
			link = $rootScope.base_url+'/locations/delete';
			$.ajax({
				url: link,
				type: 'POST',
				data: {id:id},
				success:function(data){
					$rootScope.set_errors_modal(data,'locationDelete');
					if(data.status == 1){
						self.locationList();
					}
				},
				complete:function(){
					self.isLoading = false;
					$rootScope.$apply();
					dialogService.close('locationDelete')
				}
			})  
		},


		delete : function(id){
			var options = {
				autoOpen: false,
				modal: true,
				title: $rootScope.Users.translateText('Atenção'),
				width: 300,
				height:'auto',
				resizable:true,
				dialogClass: "noclose", 
			};
			model = [];  
			$rootScope.location_id = id;                    
			dialogService.open('locationDelete','locationDelete', model, options).then();
		},


		add : function(){
			var options = {
				autoOpen: false,
				modal: true,
				title: $rootScope.Users.translateText('Adicionar localidade'),
				width: 300,
				height:'auto',
				resizable:true,
				dialogClass: "noclose", 
			};
			model = [];  
			$rootScope.form = [];
			$rootScope.form.error = [];
			dialogService.open('locationAdd','locationAdd', model, options).then();
		},


		addConfirm : function(){
			link = $rootScope.base_url+'/locations/add'
			self.isLoading = true;			

			data = {};
			data.name = $rootScope.form.name;
			if($rootScope.form.default){
				data.default = 1;
			}else{
				data.default = 0;
			}

			data.zoom = Map.map.zoom;
			data.dot = {};
			data.dot.lat = Map.map.getCenter().lat();
			data.dot.lng = Map.map.getCenter().lng();

			$rootScope.form.error = [];
			$.ajax({
				url: link,
				type: 'POST',
				data: data,
				success:function(data){
					$rootScope.set_errors_modal(data,'locationAdd');
					if(data.status == 1){
						self.locationList();
					}
				},
				complete:function(){
					self.isLoading = false;
					$scope.$apply();
					$rootScope.$apply();
				}
			})  
		}      
   
	} 	
	return self;

})



     