

app.controller('RouterTypesController', function (Functions,$rootScope,$scope,$http,dialogService, $window,$element,Upload,Validation,$timeout, Users, LevelsAndModes) {

	
	$rootScope.dialogService = dialogService;	

	//GOOGLE ANALYTICS------------------------------------------------------------------
	if ($rootScope.run_analytics){
	  (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
	  (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
	  m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
	  })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');
	  ga('create', 'UA-REPLACE-WITH-YOUR-ID', 'auto');
	  ga('set', 'page', '/tipos_roteadores');
	  ga('send', 'pageview');
	}
	//GOOGLE ANALYTICS------------------------------------------------------------------

	$scope.initialize = function(link){
		$rootScope.levelsAndModes = LevelsAndModes;
		Users.getCurrentUser(link + '/users/get_current_user');
	}

	$scope.list_all = function(link){ 	
		$rootScope.base_url= link;
		$rootScope.host_types = [];	
		$http.post(link+'/list_all').success(function(data){		
			router_types = []
			angular.forEach(data,function(val,index){
				type = val;
				if(val.bridge){
					type.bridge = 1;
				}else{
					type.bridge = 0;
				}
				router_types.push(type);
			});

			$rootScope.router_types = router_types;		      	
		});	
	}


	$scope.add_router_type_confirm = function(link){
		
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
		if( $rootScope.form.bridge == ''|| typeof($rootScope.form.bridge) == 'undefined'){
			if($rootScope.form.bridge != 0){
				$rootScope.form.error.bridge  = $rootScope.Users.translateText('Selecione o tipo');
				erro = true;	
			}
			
		}		
		if($rootScope.form.manufacturer == ''|| typeof($rootScope.form.manufacturer) == 'undefined'){
			$rootScope.form.error.manufacturer  = $rootScope.Users.translateText('Informe o fabricante');
			erro = true;
		}

		if($rootScope.form.technology == ''|| typeof($rootScope.form.technology) == 'undefined'){
			$rootScope.form.error.technology  = $rootScope.Users.translateText('Informe a tecnologia usada');
			erro = true;
		}

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


		console.clear();
		
		if(!erro){

			// console.log($scope.file);

			if($scope.file){
				file_name = $scope.file[0].name;
				file = $scope.file[0];
			}else{
				file_name = $rootScope.form.image;
				file = [];
			}


			

			//montar vetor de dados para cadastro
			data = [];			
			data.name = $rootScope.form.name;
			data.price = $rootScope.form.price;
			data.bridge = $rootScope.form.bridge;
			data.technology = $rootScope.form.technology;
			data.manufacturer = $rootScope.form.manufacturer;
			data.image = file_name;

			link = $rootScope.base_url;
			if($rootScope.editing){
				link += '/edit';
				data.id = $rootScope.form.id;
			}else{
				link += '/add';
			}


			
			Upload.upload({
	                  url: link,
	                  fields: data,
	                  file: file
                  }).progress(function (evt) {
				// proresso
                  }).success(function (data) {
                  	if(data.status == 1){
					$rootScope.message = data.message +'<br/>';						
					$scope.list_all($rootScope.base_url);			

					$timeout(function() {
						$rootScope.message = '';
				      	$rootScope.dialogService.close('add_router_type_modal');							
					}, 3000);	
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




	$scope.add_router_type = function(){
		//abrrir modal de cadastro
	      var options = {
			autoOpen: false,
			modal: true,
			title: $rootScope.Users.translateText('Novo modelo de roteador'),
			width: 600,
			resizable:false,
			position: {
				my: "center center+50",
			    	of: '#conteudo',
			    	collision: "fit"
		      }
		};
		model = [];		
		//zerando o form
		$rootScope.form = [];
		$rootScope.form.error = [];
		$rootScope.form.name = '';
		$rootScope.form.type = '';
		$rootScope.form.manufacturer = '';
		$rootScope.form.price = '';
		$rootScope.form.technology = '';
		$rootScope.form .image = '';
		$rootScope.editing = false;
		$rootScope.form.bridge = '';


		$rootScope.dialogService.open('add_router_type_modal','add_router_type_modal', model, options).then();
	}


	$scope.getNumber = function(num) {
	    return new Array(num);   
	}

	$scope.getFilteredResults = function() {
	    return $scope.$eval("material in materials = (contacts|filter:search|orderBy:['name']) | itemsPerPage : 10");
	}
	
	$scope.close = function(id){
		$rootScope.dialogService.close(id);
	}

	$scope.money_format = function(val){		
		return Functions.money_format(val,2,3,'.',',');		
	}	

	$scope.delete_router_type = function(id){
		//abrrir modal de alteração
		  var options = {
			autoOpen: false,
			modal: true,
			title: $rootScope.Users.translateText('Atenção'),
			width: 250,
			resizable:false,	
		};
		model = [];		
		$rootScope.router_type_id = id;
		$rootScope.dialogService.open('delete_modal','delete_modal', model, options).then();	
		
	}

	$scope.delete = function(id){
		link = $rootScope.base_url+'/delete';
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
	            	}else{  
					
					$rootScope.message_success = data.message+'<br/>';	
										
					if(typeof(data.errors._extras) != 'undefined'){
                  			$rootScope.message_error += data.errors._extras;
                  		}					
                  		$rootScope.dialogService.close('delete_modal');	
					$timeout(function() {
						$rootScope.message_success = '';
						
					}, 3000);		
	            	}
			},
			complete:function(){
				$scope.list_all($rootScope.base_url);	
				$scope.$apply();
				$rootScope.$apply();

			}
		})		
	}


	$scope.edit_router_type = function(id){
		//abrrir modal de alteração		
		angular.forEach($rootScope.router_types,function(val,index){
			if(val.id == id){
				$rootScope.form = $rootScope.router_types[index];
			}
		});

	      var options = {
			autoOpen: false,
			modal: true,
			title: $rootScope.Users.translateText('Editar modelo de roteador'),
			width: 600,
			resizable:false,	
			dialogClass: "noclose",	
		};
		model = [];	
		$rootScope.editing = true;
		$rootScope.dialogService.open('add_router_type_modal','add_router_type_modal', model, options).then();
	}

});



