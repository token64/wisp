

app.service('Materials', function(Map, $rootScope, Map,Projects,dialogService,$timeout,Cables){
	
	var self = {
		isLoading : false,
		materials : [],
		kits : [],
		editing : false,
		adding: false,
		visualizing : false,


		listKits : function(){	
			self.isLoading = true;
			link = $rootScope.base_url+'/material_kits/list_all'
			$.ajax({
				url: link,
				type: 'POST',
				success:function(data){
					// console.log(data);
					self.kits = data;					
				},
				complete:function(){
					$rootScope.$apply();
					self.isLoading = false;
				}
			})  			
		},

		listMaterials : function(){
			self.isLoading = true;
			link = $rootScope.base_url+'/material_types/list_all'
			$.ajax({
				url: link,
				type: 'POST',
				success:function(data){
					// console.log(data);
					self.materials = data;					
				},
				complete:function(){
					$rootScope.$apply();
					self.isLoading = false;
				}
			})  
		},



	
	}

	return self;

})

