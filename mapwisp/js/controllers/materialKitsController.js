

app.controller('MaterialKitsController', function (Functions,$rootScope,$scope,$http,dialogService, $window,$element,Upload,Validation,$timeout,Users,LevelsAndModes) {

	$rootScope.dialogService = dialogService;	

	$scope.initialize = function (link) {
		$rootScope.LevelsAndModes = LevelsAndModes;
		Users.getCurrentUser(link + '/users/get_current_user');
	}

	//GOOGLE ANALYTICS------------------------------------------------------------------
	if ($rootScope.run_analytics){
	  (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
	  (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
	  m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
	  })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');
	  ga('create', 'UA-REPLACE-WITH-YOUR-ID', 'auto');
	  ga('set', 'page', '/kits_ferragens');
	  ga('send', 'pageview');
	}
	//GOOGLE ANALYTICS------------------------------------------------------------------
	
	$scope.find_data = function(link_kits,link_materials){ 		
		//buscar todos os kits e ferragens deles
		$rootScope.kits = [];
		$.ajax({
			url: link_kits,
			type: 'POST',
			success:function(data){
				data_kits = data;     				
				$rootScope.materials = [];	
				$http.post(link_materials).success(function(data){		
					$rootScope.materials = data;	
					angular.forEach(data_kits,function(kit,index){

						if(Functions.count_object(kit.material_types) > 0){
							materials = [];
							angular.forEach(kit.material_types,function(val,index){
                                var material_data = Functions.find_on($rootScope.materials,'id',val.id);
                                materials[index] = {};
                                materials[index].id = material_data.id;
                                materials[index].description = material_data.description;
                                materials[index].image = material_data.image;
                                materials[index].name = material_data.name;
                                materials[index].price = material_data.price;
                                materials[index].price_type = material_data.price_type;
								materials[index].quantity = val._joinData.quantity;
							});	
							kit.material_types = materials;
						}					
						$rootScope.kits.push(kit);
					});
				});

			},
			complete:function(){
				$rootScope.$apply();
			}
		})
	}


	$scope.add_material_type_confirm = function(link,link_materials){
		
		$rootScope.form.error = [];
		erro = false;

		if($rootScope.form.name == ''|| typeof($rootScope.form.name) == 'undefined'){
			$rootScope.form.error.name  = $rootScope.Users.translateText('Informe o nome do kit');
			erro = true;
		}
		if($rootScope.materials_form.length == 0){
			$rootScope.form.error.materials  = $rootScope.Users.translateText('Adicione pelo menos uma ferragem');
			erro = true;	
		}
		
		if(!erro){
			link_2 = link;
			if($rootScope.editing){
				link_2 += '/edit';					
			}else{
				link_2 += '/add';					
			}

			materials = [];
			angular.forEach($rootScope.materials_form,function(val,index){
				obj = {};
				obj.id = val.id;							

				obj._joinData = {};	
				obj._joinData.quantity = val.quantity;
				
				materials.push(obj);
			});

			data = {};
			if($rootScope.editing){
				data.id = $rootScope.kit_id;
			}
			data.name = $rootScope.form.name;
			data.material_types = materials;

			$.ajax({
				url: link_2,
				type: 'POST',
				data: data,
				success:function(data){

					if(data.status == 1){
						$scope.message_success = data.message;	
						$rootScope.kits = [];		
						$http.post(link+'/list_all').success(function(data){		
							data_kits = data;   							
							angular.forEach(data_kits,function(kit,index){
								if(Functions.count_object(kit.material_types) > 0){
									materials = [];
									angular.forEach(kit.material_types,function(val,index){
										var material_data = Functions.find_on($rootScope.materials,'id',val.id);
                                        materials[index] = {};
                                        materials[index].id = material_data.id;
                                        materials[index].description = material_data.description;
                                        materials[index].image = material_data.image;
                                        materials[index].name = material_data.name;
                                        materials[index].price = material_data.price;
                                        materials[index].price_type = material_data.price_type;
										materials[index].quantity = val._joinData.quantity;
									});	
									kit.material_types = materials;
								}					
								$rootScope.kits.push(kit);
							});   
										
							$timeout(function() {
								$rootScope.message_success = '';
						      	$rootScope.dialogService.close('add_kit_modal');							
							}, 3000);	
						});
	                  	}else{
	                  		$rootScope.message_error_modal = data.message;	
	                  		if(typeof(data.errors._extras) != 'undefined'){
	                  			$rootScope.message_error_modal += data.errors._extras;
	                  		}				
						angular.forEach(data.errors,function(val,index){
							$scope.form.error[index] = val;
						});
						$timeout(function() {
							$rootScope.message_error_modal = '';
					      }, 3000);
					}
				},
				complete:function(){
					$scope.$apply();
				}
			})

		}
	}

	$scope.remove_material_kit_form = function(index){
		$rootScope.materials_form.splice(index,1);
	}
	
	$scope.material_to_kit = function(){
		if($scope.material_selected != '' && typeof($scope.material_selected) != 'undefined'){
			//verificar se este material ja esta selecionado
			id = $rootScope.materials[$scope.material_selected].id;
			if(Functions.find_on($rootScope.materials_form,'id',id)){
				//se ja estiver no array, vou incrementar a qtt
				angular.forEach($rootScope.materials_form,function(val,index){
					if(val['id'] === id){
						$rootScope.materials_form[index].quantity++;
					}			
				});				
			}else{
				obj = $rootScope.materials[$scope.material_selected];
				obj.quantity = 1;
				$rootScope.materials_form.push(obj);
			}
		}		
	}
	

	//função de botoes que nao enviam requisições
	$scope.add_material_kit = function(id){
		
		if(!id){
			$rootScope.form = [];
			$rootScope.editing = false;
			$rootScope.materials_form = [];
			var options = {
				autoOpen: false,
				modal: true,
				title: $rootScope.Users.translateText('Adicionar Kit'),
				width: 450,
				resizable:false,	
				dialogClass: "noclose",	
			};

		}else{
			$rootScope.kit_id = id
			$rootScope.editing = true;

			//encontrar o kit
			angular.forEach($rootScope.kits,function(val,index){
				if(val.id == id){
					$rootScope.form = [];
					$rootScope.form.name = val.name;
					$rootScope.materials_form = val.material_types;
				}
			});


			var options = {
				autoOpen: false,
				modal: true,
				title: $rootScope.Users.translateText('Editar Kit'),
				width: 450,
				resizable:false,	
				dialogClass: "noclose",	
			};
		}
		model = [];	
		$rootScope.dialogService.open('add_kit_modal','add_kit_modal', model, options).then();
	}

	$scope.verif_quantity = function(index){
		if($rootScope.materials_form[index].quantity == 0){
			$rootScope.materials_form[index].quantity = 1;
		}
	}

	$scope.delete = function(id,link) {

		$.ajax({
			url: link,
			type: 'POST',
			data: {id: id},
			success:function(data){
				if(data.status == 0){ 
	            		$rootScope.message_error = data.message;
	            		if(typeof(data.errors._extras) != 'undefined'){
                  			$rootScope.message_error_modal += data.errors._extras;
                  		}	
	            		$rootScope.dialogService.close('delete_modal');							            		
	            		$timeout(function() {
						$rootScope.message_error = '';			      	
					}, 3000);	
					$scope.$apply();
	            	}else{  
					angular.forEach($rootScope.kits,function(val,index){
						if(val.id == id){
							$rootScope.kits.splice(index,1);
						}
					});

					$rootScope.message_success = data.message;
					$rootScope.dialogService.close('delete_modal');							
					$scope.$apply();
					$timeout(function() {
						$rootScope.message_success = '';
					}, 3000);		
	            	}
			}
		});
	}




	$scope.remove_material_from_kit = function(kit_id,material_id,link) {
		erro = false;
		angular.forEach($rootScope.kits,function(kit,index_kit){
			if(kit.id == kit_id){
				if(kit.material_types.length == 1){
					$rootScope.message_error_modal = $rootScope.Users.translateText('Você nao pode excluir todas as ferragens do kit.<br/>Adicione outra ferragem para poder remover esta');
					erro = true;
				}else{
					index_kit_final = index_kit;
					angular.forEach(kit.material_types,function(material,index){
						if(material.id == material_id){
							kit.material_types.splice(index,1);
						}
					});	
				}
			}		
		});	

		if(!erro){
			
			// apos remover eu mando a requisição de atualização
			materials = [];
			angular.forEach($rootScope.kits[index_kit_final].material_types,function(val,index){
				obj = {};
				obj.id = val.id;							

				obj._joinData = {};	
				obj._joinData.quantity = val.quantity;
				
				materials.push(obj);
			});
			data = {};
			data.name = $rootScope.kits[index_kit_final].name;
			data.id = kit_id;
			data.material_types = materials;

			$.ajax({
				url: link,
				type: 'POST',
				data: data,
				success:function(data){
					if(data.status == 0){
						$rootScope.message_error_modal = data.message+'. ';
						$rootScope.message_error +='. '+data.errors._extras;
					}else{
						$rootScope.message_success_modal = data.message;
					}					
					$timeout(function() {
						$rootScope.message_error_modal = '';
						$rootScope.message_success_modal = '';
				      	$rootScope.dialogService.close('confirm_modal');							
					}, 3000);	
				},
				complete:function(){
					$rootScope.$apply();
				}
			})
		}else{
			$timeout(function() {
				$rootScope.message_error_modal = '';
		      	$rootScope.dialogService.close('confirm_modal');							
			}, 5000);	
		}
			

	}



	$scope.remove_material_from_kit_confirm = function(kit_id,material_id){
		$rootScope.kit_id = kit_id;
		$rootScope.material_id = material_id;

		var options = {
			autoOpen: false,
			modal: true,
			title:'Atenção',
			width: 250,
			resizable:false,	
			dialogClass: "noclose",	
			close:function(){
				delete($rootScope.kit_id);
				delete($rootScope.material_id);
			}
		};
	
		model = [];	
		$rootScope.dialogService.open('confirm_modal','confirm_modal', model, options).then();
	}

	

	$scope.remove_kit = function(id) {
		
	      
		var options = {
			autoOpen: false,
			modal: true,
			title:'Atenção',
			width: 250,
			resizable:false,	
			dialogClass: "noclose",	
		};
	
		$rootScope.kit_id = id;
		model = [];	
		$rootScope.dialogService.open('delete_modal','delete_modal', model, options).then();
	}

	$scope.getFilteredResults = function() {
	    return $scope.$eval("material in material_types = (contacts|filter:search|orderBy:['name']) | itemsPerPage : 10");
	}



	$scope.close = function(id,link_kits,link_materials){
		$rootScope.dialogService.close(id);
		this.find_data(link_kits,link_materials);
	}

});
