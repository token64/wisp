

app.controller('MaterialTypesController', function (Functions,$rootScope,$scope,$http,dialogService, $window,$element,Upload,Validation,$timeout,Users,LevelsAndModes) {

	
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
	  ga('set', 'page', '/tipos_ferragens');
	  ga('send', 'pageview');
	}
	//GOOGLE ANALYTICS------------------------------------------------------------------

	$scope.list_all = function(link){ 	
		$rootScope.list_all_link = link;
		$rootScope.materials = [];	
		$http.post(link).success(function(data){		
			$rootScope.materials = data;		      	
		});	
	}

	$scope.add_material_type_confirm = function(link){
		$rootScope.form.error = [];
		erro = false;
		if($rootScope.form.name == ''|| typeof($rootScope.form.name) == 'undefined'){
			$rootScope.form.error.name  = $rootScope.Users.translateText('Informe o nome');
			erro = true;
		}
		if( $rootScope.form.price == ''|| typeof($rootScope.form.price) == 'undefined'){
			$rootScope.form.error.price  = $rootScope.Users.translateText('Informe o custo');
			erro = true;	
		}
		if($rootScope.form.price_type == ''|| typeof($rootScope.form.price_type) == 'undefined'){
			$rootScope.form.error.price_type  = $rootScope.Users.translateText('Informe o tipo de contagem');
			erro = true;
		}
//		if($rootScope.form.description == ''|| typeof($rootScope.form.description) == 'undefined'){
//			$rootScope.form.error.description  = 'Informe a descrição';
//			erro = true;
//		}
//		if($rootScope.form.description == ''|| typeof($rootScope.form.description) == 'undefined'){
//			$rootScope.form.error.description  = 'Informe a descrição';
//			erro = true;
//		}
		
//		if(!$rootScope.editing){
//			if(typeof($scope.file) != 'undefined'){
//				if(Functions.count_object($scope.file) == 0){
//					$rootScope.form.error.file  = 'Escolha um arquivo de  imagem(jpg, gif ou png) com no máximo 2Mb';
//					erro = true;	
//				}
//			}else{
//				$rootScope.form.error.file  = 'Escolha um arquivo de  imagem(jpg, gif ou png) com no máximo 2Mb';
//				erro = true;	
//			}	
//		}

		
		
		if(!erro){

			if($scope.file){
				file_name = $scope.file[0].name;
				file = $scope.file[0];
			}else{
				file_name = $rootScope.form.image;
				file = [];
			}

			if($rootScope.editing){
				link += '/edit';					
			}else{
				link += '/add';					
			}

			Upload.upload({
	                  url: link,
	                  fields: {
	                  	name : $scope.form.name,
					price : $scope.form.price, 
					price_type : $scope.form.price_type,
					description : $scope.form.description,
					image : file_name,
					id: $scope.form.id,
	                  },
	                  file: file
                  }).progress(function (evt) {
				// proresso
                  }).success(function (data) {
                  	if(data.status == 1){
                  		material = [];
					material.name = $scope.form.name;
					material.price_type = $scope.form.price_type;
					material.price = $scope.form.price;
					material.image = file_name;
					material.description = $scope.form.description;	
					material.id = data.id;	

					$rootScope.message = data.message +'<br/>';	
					
					$scope.list_all($rootScope.list_all_link)			

					$timeout(function() {
						$rootScope.message = '';
				      	$rootScope.dialogService.close('add_material_modal');							
					}, 3000);	

					// console.log('file ' + config.file.name + 'uploaded. Response: ' + data);
                  	}else{
                  		$rootScope.message_error_modal = data.message +'<br/>';	
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
                  });

		}

	}

	$scope.getFilteredResults = function() {
	    return $scope.$eval("material in materials = (contacts|filter:search|orderBy:['name']) | itemsPerPage : 10");
	}

	$scope.close = function(id){
		$rootScope.dialogService.close(id);
	}

	$scope.delete = function(id,link){
			
		$.ajax({
			url: link,
			type: 'POST',
			data: {id: id},
			success:function(data){
				if(data.status == 0){ 
	            		$rootScope.message_error = data.message+'<br/>';	
	            		if(typeof(data.errors._extras) != 'undefined'){
                  			$rootScope.message_error += data.errors._extras;
                  		}
	            		$rootScope.dialogService.close('delete_modal');							            		
	            		$timeout(function() {
						$rootScope.message_error = '';			      	
					}, 3000);	
					$scope.$apply();
	            	}else{  
					angular.forEach($rootScope.materials,function(val,index){
						if(val.id == id){
							$rootScope.materials.splice(index,1);
						}
					});
					$rootScope.message_success = data.message+'<br/>';	
					$rootScope.dialogService.close('delete_modal');						
					
					$timeout(function() {
						$rootScope.message_success = '';
					}, 3000);		
	            	}
			},
			complete:function(){
				$scope.$apply();
			}
		})		
	}

	$scope.money_format = function(val){		
		return Functions.money_format(val,2,3,'.',',');		
	}	

	//função de botoes que nao enviam requisições
	$scope.edit_material_type = function(id){
		//abrrir modal de alteração		
		angular.forEach($rootScope.materials,function(val,index){
			if(val.id == id){
				$rootScope.form = $rootScope.materials[index];
			}
		});

	      var options = {
			autoOpen: false,
			modal: true,
			title: $rootScope.Users.translateText('Editar ferragem'),
			width: 600,
			resizable:false,	
			dialogClass: "noclose",	
		};
		model = [];	
		$rootScope.editing = true;
		$rootScope.dialogService.open('add_material_modal','add_material_modal', model, options).then();
	}

	$scope.delete_material = function(id){
		//abrrir modal de alteração
		  var options = {
			autoOpen: false,
			modal: true,
			title: $rootScope.Users.translateText('Atenção'),
			width: 250,
			resizable:false,	
		};
		model = [];		
		$rootScope.material_id = id;
		$rootScope.dialogService.open('delete_modal','delete_modal', model, options).then();
	
		
	}
	

	$scope.add_material_type = function(){
		//abrrir modal de cadastro
	      var options = {
			autoOpen: false,
			modal: true,
			title: $rootScope.Users.translateText('Nova ferragem'),
			width: 600,
			resizable:false,	
		};
		model = [];		
		//zerando o form
		$rootScope.form = [];
		$rootScope.form.error = [];
		$rootScope.form.name = '';
		$rootScope.form.price_type = '';
		$rootScope.form.price = '';
		$rootScope.form.image = '';
		$rootScope.form.description = '';
		$rootScope.form.id = '';
		$rootScope.editing = false;

		$rootScope.dialogService.open('add_material_modal','add_material_modal', model, options).then();
	}






});
