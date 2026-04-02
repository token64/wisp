

app.controller('HostTypesController', function (Functions,$rootScope,$scope,$http,dialogService, $window,$element,Upload,Validation,$timeout,Users,LevelsAndModes) {

	
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
	  ga('set', 'page', '/tipos_de_ativo');
	  ga('send', 'pageview');
	}
	//GOOGLE ANALYTICS------------------------------------------------------------------

	$scope.list_all = function(link){ 	
		$rootScope.base_url= link;
		$rootScope.host_types = [];	
		$http.post(link+'/list_all').success(function(data){		
			$rootScope.host_types = data;		      	
		});	
	}

	$scope.get = function(id, link){
		$rootScope.base_url = link;
		
		$.ajax({
			url: link+'/get',
			data: {id:id},
			type:'POST',
			success:function(data){
				$rootScope.host_type = data;
				$scope.$apply();
			}
		})

	}




	$scope.add_host_type_confirm = function(link){
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
		if( $rootScope.form.category == ''|| typeof($rootScope.form.category) == 'undefined'){
			$rootScope.form.error.category  = $rootScope.Users.translateText('Informe o tipo do equipamento');
			erro = true;	
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


		//validar as portas
		cont = 0;
		console.clear();
		erro_port  = false;
		angular.forEach($rootScope.form.ports,function(val,index){
			//se a categoria da porta nao estiver selecionada
			if( val.category == ''|| typeof(val.category) == 'undefined'){
				erro_port = true;
				cont++;
			}else{
				//se a categoria da porta estiver selecionada , validar outros itens
				if(val.category == 1){
					//SFP nao precisa validar mais nada
				}

				if(val.category == 2){
					//se for GE
					if( val.network == ''|| typeof(val.network) == 'undefined'){
						erro_port = true;
						cont++;
					}
				}

				if(val.category == 3){
					//se for Fibra direto 
					if( val.sxdx_select == ''|| typeof(val.sxdx_select) == 'undefined'){
						erro_port = true;
						cont++;
					}else if(val.sxdx_select == 1){
						//validar sx
						if( val.wavelength1 == ''|| typeof(val.wavelength1) == 'undefined'){
							erro_port = true;
							cont++;
						}						
					}else if(val.sxdx_select == 2){
						//validar dx
						if( val.wavelength1 == ''|| typeof(val.wavelength1) == 'undefined'){
							erro_port = true;
							cont++;
						}
						if( val.wavelength2 == ''|| typeof(val.wavelength2) == 'undefined'){
							erro_port = true;
							cont++;
						}						
					}					
				}				
			}
			if(erro_port){
    			      var el = angular.element('#porta_'+(index+1));
 				el.attr('class', 'small-6 medium-3 columns ports_cad left border-error');
			}else{
				var el = angular.element('#porta_'+(index+1));
 				el.attr('class', 'small-6 medium-3 columns ports_cad left');
			}

		});


		if(!erro && !erro_port){

			// console.log($scope.file);

			if($scope.file){
				file_name = $scope.file[0].name;
				file = $scope.file[0];
			}else{
				file_name = $rootScope.form.image;
				file = [];
			}

			link = $rootScope.base_url;
			

			//montar vetor de dados para cadastro
			data = [];			
			data.name = $rootScope.form.name;
			data.price = $rootScope.form.price;
			data.category = $rootScope.form.category;

			if($rootScope.form.technology  != '' && typeof($rootScope.form.technology) != 'undefined'){
				data.technology = $rootScope.form.technology;
			}

			if($rootScope.editing){
				link += '/edit';
				data.id = $rootScope.form.id;					
			}else{
				link += '/add';
				data.id = '';					
			}
			
			data.manufacturer = $rootScope.form.manufacturer;
			data.image = file_name;

			
			data.ports = [];
			angular.forEach($rootScope.form.ports,function(val,index){
				port = {};
				port.port_information = {};
				//se a categoria da porta estiver selecionada , validar outros itens
				port.port_information.category = val.category;
				port.port_information.number = val.number;

				if(val.category == 1){
					// SFP nao precisa incluir mais nada					
					data.ports.push(port);	
				}

				if(val.category == 2){
					//se for GE
					port.port_information.network = val.network;
					data.ports.push(port);	
				}

				if(val.category == 3){
					//se for Fibra direto 
					if(val.sxdx_select == 1){
						// 1 = tx
						port.port_information.sxdx = 1;
						port.port_information.wavelength = val.wavelength1;
  					      data.ports.push(port);
					}else if(val.sxdx_select == 2){
						// 1 = tx
						// 2 = rx

						// montar porta tx					
						port.port_information.sxdx =1;
						port.port_information.wavelength = val.wavelength1;
						data.ports.push(port);	
						
						// montar porta rx
						port = {};
						port.port_information = {};
						port.port_information.category = val.category;
						port.port_information.number = val.number;
						port.port_information.sxdx = 2;
						port.port_information.wavelength = val.wavelength2;
						data.ports.push(port);	
					}					
				}							
				
			});	

			
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
				      	$rootScope.dialogService.close('add_host_type_modal');							
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



	$scope.draw_ports = function(){
		if($rootScope.form.num_ports == 0){
			$rootScope.form.num_ports = 1;
		}
		if($rootScope.form.num_ports > 99){
			$rootScope.form.num_ports = 99;
		}

		//fazer contagem das portas e montar um vetor predefinido das portas para desenhar
		$rootScope.form.ports = [];

		var numPorts = $rootScope.form.num_ports;

		if($rootScope.form.num_ports_from_zero){
			numPorts--;
			i = 0;
		}else{
			i = 1;
		}

		while(i <= numPorts){			
			port = [];
			port.number = i;
			port.category = '';
			port.network = '';
			port.sxdx_select = '';
			port.wavelength1 = '';
			port.wavelength2 = '';

			$rootScope.form.ports.push(port);
			i++;
		}
	}

	

	$scope.add_host_type = function(){
		//abrrir modal de cadastro
	      var options = {
			autoOpen: false,
			modal: true,
			title: $rootScope.Users.translateText('Novo modelo de ativo de rede'),
			width: 600,
			resizable:false,	
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
		$rootScope.form.num_ports = 1;
		$rootScope.form.num_ports_from_zero = false;

		$scope.draw_ports();

		$rootScope.dialogService.open('add_host_type_modal','add_host_type_modal', model, options).then();
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

	



	$scope.delete_host_type = function(id){
		//abrrir modal de alteração
		  var options = {
			autoOpen: false,
			modal: true,
			title: $rootScope.Users.translateText('Atenção'),
			width: 250,
			resizable:false,	
		};
		model = [];		
		$rootScope.host_type_id = id;
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


	

	$scope.edit_ports = function(id){
		
		//fazer uma verificação das portas para edição
		ports_edit = [];
		count = null;
		ultimaPorta = [];
		angular.forEach($rootScope.host_type.ports,function(val,index){
			if(val.port_information.category == 1){	
				// SFP
				ports_edit.push(val);

			}
			if(val.port_information.category == 2){
				//se for GE
				ports_edit.push(val);
				count++;
			}
			if(val.port_information.category == 3){
				//se for GE				
				if(val.port_information.number != ultimaPorta.number){
					ports_edit.push(val);
					count++;		
				}else{					
					ports_edit[ports_edit.length-1].port_information2 = val.port_information;
				}
				ultimaPorta.number = val.port_information.number;				
			}
			
		});
		
		$rootScope.ports_edit = ports_edit;

		var options = {
			autoOpen: false,
			modal: true,
			title: $rootScope.Users.translateText('Editar informações das portas'),
			width: 600,
			resizable:false,	
			dialogClass: "noclose",	
		};


		model = [];	
		$rootScope.dialogService.open('edit_port_modal','edit_port_modal', model, options).then();
	}

	

	$scope.edit_host_type = function(id){
		//abrrir modal de alteração		
		angular.forEach($rootScope.host_types,function(val,index){
			if(val.id == id){
				$rootScope.form = $rootScope.host_types[index];
			}
		});

	      var options = {
			autoOpen: false,
			modal: true,
			title: $rootScope.Users.translateText('Editar modelo de ativo de rede'),
			width: 600,
			resizable:false,	
			dialogClass: "noclose",	
		};
		model = [];	
		$rootScope.editing = true;
		$rootScope.dialogService.open('add_host_type_modal','add_host_type_modal', model, options).then();
	}

});




