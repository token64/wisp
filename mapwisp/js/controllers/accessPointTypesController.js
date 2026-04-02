

app.controller('AccessPointTypesController', function (Functions,$rootScope,$scope,$http,dialogService, $window,$element,Upload,Validation,$timeout,Users,LevelsAndModes) {
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
	  ga('set', 'page', '/tipos_pontos_de_acesso');
	  ga('send', 'pageview');
	}
	//GOOGLE ANALYTICS------------------------------------------------------------------


	$scope.list_all = function(link){ 	
		$rootScope.base_url = link;
		$http.post(link+'/list_all').success(function(data){	

			fontes = [];
			armarios = [];
			pacs = [];
			caixas_emenda = [];
			caixas_atendimento = [];
			cameras = [];


			angular.forEach(data,function(val,index){
				if(val.category == 1 ){fontes.push(val);}
				if(val.category == 2 ){armarios.push(val);}
				if(val.category == 3 ){
					pac = val;
					if(pac.pon){
						pac.pon = 1;
					}else{
						pac.pon = 0;
					}
					pacs.push(pac);

				}
				if(val.category == 4 ){caixas_emenda.push(val);}
				if(val.category == 5 ){caixas_atendimento.push(val);}
				if(val.category == 6 ){cameras.push(val);}			
			});

			
			$rootScope.fontes = fontes;
			$rootScope.armarios = armarios;
			$rootScope.pacs = pacs;
			$rootScope.caixas_emenda = caixas_emenda;
			$rootScope.caixas_atendimento = caixas_atendimento;
			$rootScope.cameras = cameras;		 	
			
		});	
	}

	$scope.add_access_point_type_confirm = function(){
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
		if($rootScope.form.manufacturer == ''|| typeof($rootScope.form.manufacturer) == 'undefined'){
			$rootScope.form.error.manufacturer  = $rootScope.Users.translateText('Informe o fabricante');
			erro = true;
		}
		if($rootScope.form.code == ''|| typeof($rootScope.form.code) == 'undefined'){
			$rootScope.form.error.code  = $rootScope.Users.translateText('Informe um código de identificação');
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

		// fonte 1
		// armário 2
		// PAC 3
		// emenas 4
		// atendimento 5
		// camera 6		
		
		if(($rootScope.form.icon == ''|| typeof($rootScope.form.icon) == 'undefined' ) && ( $rootScope.type == 3 || $rootScope.type == 4 || $rootScope.type == 5 || $rootScope.type == 6  )){
			$rootScope.form.error.icon  = $rootScope.Users.translateText('Selecione um icone');
			erro = true;
		}	

		if(($rootScope.form.pon == ''|| typeof($rootScope.form.pon) == 'undefined') && $rootScope.type == 3){
			$rootScope.form.error.pon  = $rootScope.Users.translateText('Selecione o tipo');
			erro = true;
		}

		if(($rootScope.form.max_ports == ''|| typeof($rootScope.form.max_ports) == 'undefined') && ($rootScope.type == 5 || $rootScope.type == 6)){
			$rootScope.form.error.max_ports  = $rootScope.Users.translateText('Informe o número maximo de portas');
			erro = true;
		}	

		if(($rootScope.form.initial_splitter_out == ''|| typeof($rootScope.form.initial_splitter_out) == 'undefined') && ($rootScope.type == 5 || $rootScope.type == 6)){
			$rootScope.form.error.initial_splitter_out  = $rootScope.Users.translateText('Informe o número de saídas do spliter da caixa');
			erro = true;
		}		


		if(!erro){

			link = $rootScope.base_url;

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
				
			data = {};
			data.name = $rootScope.form.name;
			data.price = $rootScope.form.price;
			data.manufacturer = $rootScope.form.manufacturer;
			data.code = $rootScope.form.code;
			data.category = $rootScope.type;
			if($rootScope.editing){
				data.id = $rootScope.access_point_type_id;
			}
			if($rootScope.type == 1){
				data.icon = 'font.png';
			}else if($rootScope.type == 2){
				data.icon = 'armario.png';
			}else if($rootScope.type == 3){
				data.icon = $rootScope.form.icon;
				data.pon = $rootScope.form.pon;
			}else if($rootScope.type == 4){
				data.icon = $rootScope.form.icon;
			}else if($rootScope.type == 5){
				data.icon = $rootScope.form.icon;
				data.max_ports = $rootScope.form.max_ports;
				data.initial_splitter_out = $rootScope.form.initial_splitter_out;
				data.radius = $rootScope.form.radius;
			}else if($rootScope.type == 6){
				data.icon = $rootScope.form.icon;
				data.max_ports = $rootScope.form.max_ports;
				data.initial_splitter_out = $rootScope.form.initial_splitter_out;
				data.radius = $rootScope.form.radius;
			}

			Upload.upload({
	                  url: link,
	                  fields:data,
	                  file: file
                  }).progress(function (evt) {
				// proresso
                  }).success(function (data) {
                  	if(data.status == 1){
                  		$rootScope.form = [];
					$rootScope.form.error = [];
					$rootScope.form.name = '';
					$rootScope.form.icon = '';
					$rootScope.form.manufacturer = '';
					$rootScope.form.code = '';
					$rootScope.form.model = '';
					$rootScope.form.price = '';
					$rootScope.form.pon = '';
					$rootScope.form.initial_spliter_out = '';

					$rootScope.message = data.message;	
					
					$scope.list_all($rootScope.base_url);		

					$timeout(function() {
						$rootScope.message = '';
				      	$rootScope.dialogService.close('add_access_point_type_modal');							
					}, 3000);	

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
                  });

		}

	}

	$scope.verif_quantity = function(field){
		if($rootScope.form[field] == 0){
			$rootScope.form[field] = 1;
		}		
	}

	$scope.getFilteredResults = function() {
	    return $scope.$eval("material in materials = (contacts|filter:search|orderBy:['name']) | itemsPerPage : 10");
	}

	$scope.close = function(id){
		$rootScope.dialogService.close(id);
	}


	$scope.remove_access_point_type = function(id){
		//abrrir modal de alteração
		  var options = {
			autoOpen: false,
			modal: true,
			title:'Atenção',
			width: 250,
			resizable:false,	
		};
		model = [];		
		$rootScope.access_point_type_id = id;
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
	            		$rootScope.message_error = data.message;
	            		$rootScope.dialogService.close('delete_modal');							            		
	            		$timeout(function() {
						$rootScope.message_error = '';			      	
					}, 3000);	
					$scope.$apply();
	            	}else{  
					
					$scope.list_all($rootScope.base_url);		

					$rootScope.message_success = data.message;
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

	

	//função de botoes que nao enviam requisições
	$scope.edit_access_point_type = function(id,category){

		if(category == 1){
			array = 'fontes';
		}else if(category == 2){
			array = 'armarios';
		}else if(category == 3){
			array = 'pacs';
		}else if(category == 4){
			array = 'caixas_emenda';
		}else if(category == 5){
			array = 'caixas_atendimento';
		}else if(category == 6){
			array = 'cameras';
		}

		//abrrir modal de alteração		
		angular.forEach($rootScope[array],function(val,index){
			if(val.id == id){
				$rootScope.form = $rootScope[array][index];

				console.log(val);
			}
		});

	    var options = {
			autoOpen: false,
			modal: true,
			title: $rootScope.Users.translateText('Editar tipo de ponto de acesso'),
			width: 600,
			resizable:false,	
			dialogClass: "noclose",
            close: function(){
				$rootScope.editing = false;
			}
		};
		model = [];	

		$rootScope.type = category;
		$rootScope.editing = true;
		$rootScope.access_point_type_id = id;
		$rootScope.dialogService.open('add_access_point_type_modal','add_access_point_type_modal', model, options).then();
	}



	$scope.add_access_point_type = function(type){
		//abrrir modal de cadastro
		// fonte 1
		// armário 2
		// PAC 3
		// emenas 4
		// atendimento 5
		// camera 6	    
		switch(type){
			case 1:
				title = $rootScope.Users.translateText('Novo tipo de fonte');
				break;
			case 2:
				title = $rootScope.Users.translateText('Novo tipo de armário');
				break;
			case 3:
				title = $rootScope.Users.translateText('Novo tipo de PAC');
				break;
			case 4:
				title = $rootScope.Users.translateText('Novo tipo de caixa de emendas');
				break;
			case 5:
				title = $rootScope.Users.translateText('Novo tipo de caixa de atendimento');
				break;
			case 6:
				title = $rootScope.Users.translateText('Novo tipo de camera');
				break;
			default:
				title = $rootScope.Users.translateText('Novo tipo')
				break;
		}
	    
	      var options = {
			autoOpen: false,
			modal: true,
			title: title,
			width: 600,
			resizable:false,	
		};
		
		model = [];	
		$rootScope.type = type;

		//zerando o form
		$rootScope.form = [];
		$rootScope.form.error = [];
		$rootScope.form.name = '';
		$rootScope.form.icon = '';
		$rootScope.form.manufacturer = '';
		$rootScope.form.code = '';
		$rootScope.form.model = '';
		$rootScope.form.price = '';
		$rootScope.form.pon = '';
		$rootScope.form.initial_spliter_out = '';

		$rootScope.dialogService.open('add_access_point_type_modal','add_access_point_type_modal', model, options).then();
	}

	$scope.money_format = function(val){		
		return Functions.money_format(val,2,3,'.',',');		
	}
});