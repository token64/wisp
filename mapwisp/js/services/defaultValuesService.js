app.service('DefaultValues', function($rootScope){
	
	var self = {
			isLoading : false,
			//Default values, before being listed
			loss_spl_2 : null,
			loss_spl_4 : null,
			loss_spl_8 : null,
			loss_spl_16 : null,
			loss_spl_32 : null,
			loss_spl_64 : null,
			loss_km_1 : null,
			loss_km_2 : null,
			loss_km_3 : null,
			loss_km_4 : null,
			auto_reserve : null,
			cable_manufacturer : null,
			research_interval : null,
			
			list : function(is_report_window){
				self.isLoading = true;
				var base_url = $rootScope.base_url;
				if (is_report_window){
					base_url = $rootScope.base_url.split("/maps");
					base_url = base_url[0];
				}
				link = base_url+'/default_values/list_all'
				$.ajax({
					url: link,
					type: 'POST',
					async: !is_report_window,
					success:function(data){
						self.saveData(data);
					},
					complete:function(){
						self.isLoading = false;
					}
				}) 
			},
			
			saveData : function(data){
				angular.forEach(data, function(default_v, index){
					if (default_v.name == 'loss_spl_2'){
						self.loss_spl_2 = default_v.value;
					} else if (default_v.name == 'loss_spl_4'){
						self.loss_spl_4 = default_v.value;
					} else if (default_v.name == 'loss_spl_8'){
						self.loss_spl_8 = default_v.value;
					} else if (default_v.name == 'loss_spl_16'){
						self.loss_spl_16 = default_v.value;
					} else if (default_v.name == 'loss_spl_32'){
						self.loss_spl_32 = default_v.value;
					} else if (default_v.name == 'loss_spl_64'){
						self.loss_spl_64 = default_v.value;
					} else if (default_v.name == 'loss_km_1'){
						self.loss_km_1 = default_v.value;
					} else if (default_v.name == 'loss_km_2'){
						self.loss_km_2 = default_v.value;
					} else if (default_v.name == 'loss_km_3'){
						self.loss_km_3 = default_v.value;
					} else if (default_v.name == 'loss_km_4'){
						self.loss_km_4 = default_v.value;
					} else if (default_v.name == 'auto_reserve'){
						self.auto_reserve = default_v.value;
					} else if (default_v.name == 'research_interval'){
						self.research_interval = default_v.value;
					} else if (default_v.name == 'cable_manufacturer'){
						self.cable_manufacturer = {};
						self.cable_manufacturer.str_value = default_v.str_value;
						self.cable_manufacturer.id = default_v.id;
					} else if (default_v.name == 'show_only_deployeds_aps'){
						$rootScope.Painel.show_only_deployeds_aps = {};
						$rootScope.Painel.show_only_deployeds_aps.value = default_v.value;
						$rootScope.Painel.show_only_deployeds_aps.id = default_v.id;
                        $rootScope.$apply();
					} else if (default_v.name == 'block_kml_export_for_view'){
                        self.block_kml_export_for_view = {};
                        self.block_kml_export_for_view.value = default_v.value;
                        self.block_kml_export_for_view.id = default_v.id;
                        
						$rootScope.Painel.block_kml_export_for_view = {};
						$rootScope.Painel.block_kml_export_for_view.value = default_v.value;
						$rootScope.Painel.block_kml_export_for_view.id = default_v.id;
                        $rootScope.$apply();
					}
				});
			},
			
			editCableManufacturer : function(data){
				var adding = false;
				if (self.cable_manufacturer == null){
					//add
					dataSend = {name:"cable_manufacturer",str_value:data};
					adding = true;
					var address = '/default_values/add';
				} else {
					//edit
					dataSend = {id:self.cable_manufacturer.id, str_value:data};
					var address = '/default_values/edit';
				}
				
				$.ajax({
					url: $rootScope.base_url + address,
					data: dataSend,
					type: 'POST',
					success:function(data_return){
						if (adding){
							self.cable_manufacturer = {};
							self.cable_manufacturer.id = data_return.id;
							self.cable_manufacturer.str_value = data;
						} else {
							self.cable_manufacturer.str_value = data;
						}
					},
					complete:function(){
						//$scope.$apply();
					}
				});
			}
	}
	
	return self;

})