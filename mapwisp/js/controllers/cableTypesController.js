

app.controller('CableTypesController', function (Users,LevelsAndModes,Functions,$rootScope,$scope,$http,dialogService, $window,$element,Upload,Validation,$timeout) {

	
	$rootScope.dialogService = dialogService;	

	//GOOGLE ANALYTICS------------------------------------------------------------------
	if ($rootScope.run_analytics){
	  (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
	  (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
	  m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
	  })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');
	  ga('create', 'UA-REPLACE-WITH-YOUR-ID', 'auto');
	  ga('set', 'page', '/tipos_de_cabo');
	  ga('send', 'pageview');
	}
	//GOOGLE ANALYTICS------------------------------------------------------------------
	$scope.initialize = function(link){
		$rootScope.LevelsAndModes = LevelsAndModes;
		Users.getCurrentUser(link+'/users/get_current_user');
	}

	$scope.list_all = function(link){ 
		$rootScope.base_url = link;
		$rootScope.cable_types = [];		
		$.ajax({
			url: link+'/list_all',
			type: 'POST',
			success:function(data){
				angular.forEach(data,function(val,index){
					if (!(val.category == 4)){
						val.price_format = Functions.money_format(val.price,2,3,'.',',');		
						$rootScope.cable_types.push(val);
					}
				});	
				$scope.$apply();
			}		
		});	
	}

	$scope.list_color_codes = function(){ 
		$.ajax({
			url: 'color_codes/list_all',
			type: 'POST',
			success:function(data){

				$rootScope.color_codes = data;

				$scope.$apply();
			}		
		});	
	}	

	$scope.add_cable_type = function(type){
		
		if(type == 'fiber'){
			title = $rootScope.Users.translateText('Novo cabo de fibra óptica');
			$rootScope.category = 1;
		}else if(type == 'rig'){
			title = $rootScope.Users.translateText('Nova cordoalha');
			$rootScope.category = 3;
		}else{
			title = $rootScope.Users.translateText('Novo cabo UTP');
			$rootScope.category = 2;
		}
		//abrir modal de cadastro
	      var options = {
			autoOpen: false,
			modal: true,
			title:title,
			width: 600,
			resizable:false,	
		};
		model = [];		
		//zerando o form
		$rootScope.form = [];
		$rootScope.form.error = [];
		$rootScope.form.name = '';
		$rootScope.form.manufacturer = '';
		$rootScope.form.code = '';
		$rootScope.form.color = '';
		$rootScope.form.price = '';
		$rootScope.form.number_fibers = '';
		$rootScope.form.tubes = '';
		$rootScope.editing = false;

		$rootScope.dialogService.open('add_cable_type_modal','add_cable_type_modal', model, options).then();
	}



	$scope.close = function(id){
		$rootScope.dialogService.close(id);
	}

	$scope.verif_quantity = function(field){
		if($rootScope.form[field] == 0){
			$rootScope.form[field] = 1;
		}
		
	}

	$scope.add_cable_type_confirm = function(){
		$rootScope.form.error = [];
		erro = false;
		if($rootScope.form.name == ''|| typeof($rootScope.form.name) == 'undefined'  ){
			$rootScope.form.error.name  = $rootScope.Users.translateText('Informe o nome');
			erro = true;
		}
		if( $rootScope.form.color == ''|| typeof($rootScope.form.color) == 'undefined'){
			$rootScope.form.error.color  = $rootScope.Users.translateText('Escolha a cor');
			erro = true;	
		}
		if($rootScope.form.manufacturer == ''|| typeof($rootScope.form.manufacturer) == 'undefined'){
			$rootScope.form.error.manufacturer  = $rootScope.Users.translateText('Informe o fabricante');
			erro = true;
		}
		if(($rootScope.form.code == ''|| typeof($rootScope.form.code) == 'undefined') && $rootScope.category != 3){
			$rootScope.form.error.code  = $rootScope.Users.translateText('Informe o código');
			erro = true;
		}
		if($rootScope.form.price == ''|| typeof($rootScope.form.price) == 'undefined'){
			$rootScope.form.error.price  = $rootScope.Users.translateText('Informe o custo por metro');
			erro = true;
		}	
		if(($rootScope.form.number_fibers == ''|| typeof($rootScope.form.number_fibers) == 'undefined') && $rootScope.category == 1){
			$rootScope.form.error.number_fibers  = $rootScope.Users.translateText('Informe o número de fibras');
			erro = true;
		}
		if(($rootScope.form.tubes == ''|| typeof($rootScope.form.tubes) == 'undefined') && $rootScope.category == 1){
			$rootScope.form.error.tubes  = $rootScope.Users.translateText('Informe o número de tubos');
			erro = true;
		}
		if(($rootScope.form.code_color == ''|| typeof($rootScope.form.code_color) == 'undefined') && $rootScope.category == 1){
			$rootScope.form.error.code_color  = $rootScope.Users.translateText('Informe o padrão das cores das fibras');
			erro = true;
		}

		
		if(!erro){
			if($rootScope.editing){
				link = $rootScope.base_url+'/edit';					
			}else{
				link = $rootScope.base_url+'/add';					
			}


			data = {};

			if($rootScope.editing){
				data.id = $rootScope.form.id;
			}
			data.name =  $rootScope.form.name;
			data.color =  $rootScope.form.color;
			data.manufacturer =  $rootScope.form.manufacturer;
			data.price =  $rootScope.form.price;

			if($rootScope.category == 1){
				//Fibras
				data.number_fibers =  $rootScope.form.number_fibers;	
				data.tubes =  $rootScope.form.tubes;	
			} else if ($rootScope.category == 1){
				//Cabos UTP:
				//Salva como 1 fibra e 1 tubo, para representar um unico cabo UTP.
				data.number_fibers =  1;	
				data.tubes =  1;
			}

			if($rootScope.category != 3 && $rootScope.category != 2){			
				data.code_color =  $rootScope.form.code_color;
			}	

			if($rootScope.category == 1 || $rootScope.category == 2){
				data.code =  $rootScope.form.code;	
			}	

			
			data.category = $rootScope.category;


			$.ajax({
				url: link,
				type: 'POST',
				data: data,
				success:function(data){			
		            	if(data.status == 1){
		            		
						$rootScope.message = data.message;	
						
						$scope.list_all($rootScope.base_url)	;		

						$timeout(function() {
							$rootScope.message = '';
					      	$rootScope.dialogService.close('add_cable_type_modal');							
						}, 3000);	
		            	}else{
		            		$rootScope.message_error_modal = data.message;					
						angular.forEach(data.errors,function(val,index){
							$scope.form.error[index] = val;
						});
						$timeout(function() {
							$rootScope.message = '';
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

	
	$scope.edit_cable_type = function(id){
		//abrrir modal de alteração		
		angular.forEach($rootScope.cable_types,function(val,index){
			if(val.id == id){
				$rootScope.form = $rootScope.cable_types[index];

				if($rootScope.cable_types[index].category == 1){
					title = $rootScope.Users.translateText('Novo cabo de fibra óptica');
					$rootScope.category = 1;
				}else if($rootScope.cable_types[index].category == 3){
					title = $rootScope.Users.translateText('Nova cordoalha');
					$rootScope.category = 3;
				}else{
					title = $rootScope.Users.translateText('Novo cabo UTP');
					$rootScope.category = 2;
				}
			}
		});

	      var options = {
			autoOpen: false,
			modal: true,
			title: $rootScope.Users.translateText('Editar tipo de cabo'),
			width: 600,
			resizable:false,	
			dialogClass: "noclose",	
		};
		model = [];	
		$rootScope.editing = true;
		$rootScope.dialogService.open('add_cable_type_modal','add_cable_type_modal', model, options).then();
	}



	$scope.delete = function(id){
		link = $rootScope.base_url+'/delete';
		$.ajax({
			url: link,
			type: 'POST',
			data: {id: id},
			success:function(data){
				if(data.status == 0){
					$rootScope.message_error = data.message;  
					$scope.$apply();
					$timeout(function() {
						$rootScope.message_error = '';
						$rootScope.dialogService.close('delete_modal');	
						$scope.$apply();
					}, 3000);
				}else{
					angular.forEach($rootScope.cable_types,function(val,index){
						if(val.id == id){
							$rootScope.cable_types.splice(index,1);
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



	$scope.delete_cable_type = function(id){
		//abrir modal de deleção
		var options = {
			autoOpen: false,
			modal: true,
			title:'Atenção',
			width: 250,
			resizable:false,	
		};
		model = [];		
		$rootScope.cable_type_id = id;
		$rootScope.dialogService.open('delete_modal','delete_modal', model, options).then();	
		
	}



	$scope.getFilteredResults = function() {
	    return $scope.$eval("cable_type in cable_types = (contacts|filter:search|orderBy:['name']) | itemsPerPage : 10");
	}


	$scope.close = function(id){
		$rootScope.dialogService.close(id);
	}


});



	

// 	$scope.add_material_type = function(){
// 		//abrrir modal de cadastro
// 	      var options = {
// 			autoOpen: false,
// 			modal: true,
// 			title:'Nova ferragem',
// 			width: 600,
// 			resizable:false,	
// 		};
// 		model = [];		
// 		//zerando o form
// 		$rootScope.form = [];
// 		$rootScope.form.error = [];
// 		$rootScope.form.name = '';
// 		$rootScope.form.price_type = '';
// 		$rootScope.form.price = '';
// 		$rootScope.form.photo = '';
// 		$rootScope.form.description = '';
// 		$rootScope.form.id = '';
// 		$rootScope.editing = false;

// 		$rootScope.dialogService.open('add_material_modal','add_material_modal', model, options).then();
// 	}






// });
