

app.controller('ProjectsController', function (Functions,$rootScope,$scope,$http,dialogService, $window,$element,Upload,Validation,$timeout) {

	
	$rootScope.dialogService = dialogService;	

	//GOOGLE ANALYTICS------------------------------------------------------------------
	if ($rootScope.run_analytics){
	  (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
	  (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
	  m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
	  })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');
	  ga('create', 'UA-REPLACE-WITH-YOUR-ID', 'auto');
	  ga('set', 'page', '/projetos');
	  ga('send', 'pageview');
	}
	//GOOGLE ANALYTICS------------------------------------------------------------------

	$scope.list_all = function(link){ 
		$rootScope.base_url = link;
		$rootScope.cable_types = [];	

		$.ajax({
			url: link+'/list_all',
			type: 'POST',
			success:function(data){
				$rootScope.projects = [];
				angular.forEach(data,function(val,index){
					proj = val;

					if(val.deployed == true){
						proj.deployed = 1;
					}else{
						proj.deployed = 0;
					}	

					$rootScope.projects.push(proj);;

				});
				$rootScope.$apply();
			}	
		});	
	}

	



	$scope.close = function(id){
		$rootScope.dialogService.close(id);
	}

	
	
	
	$scope.edit_project = function(id){
		//abrrir modal de alteração		
		angular.forEach($rootScope.projects,function(val,index){
			if(val.id == id){
				$rootScope.form = $rootScope.projects[index];
			}
		});

	      var options = {
			autoOpen: false,
			modal: true,
			title: $rootScope.Users.translateText('Editar projeto'),
			width: 300,
			resizable:false,	
			dialogClass: "noclose",	
		};
		model = [];	
		$rootScope.editing = true;
		$rootScope.dialogService.open('edit_project_modal','edit_project_modal', model, options).then();
	}



	$scope.delete = function(id){
		link = $rootScope.base_url+'/delete';

		
		

		if($rootScope.delete_project_count == 1){
			$rootScope.msg_delete_project = $rootScope.Users.translateText('Todos os itens relacionados a este projeto serão removidos');
			$rootScope.delete_project_count = 2;
			return;
		}
		if($rootScope.delete_project_count == 2){
			$rootScope.msg_delete_project = $rootScope.Users.translateText('Você só poderá recuperar as informações se tiver um backup criado');
			$rootScope.delete_project_count =  3;
			return;
		}
		if($rootScope.delete_project_count == 3){
			$rootScope.msg_delete_project = $rootScope.Users.translateText('Deseja confirmar a deleção do projeto?');
			$rootScope.delete_project_count =  4;
			return;
		}

		if($rootScope.delete_project_count == 4){
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
						angular.forEach($rootScope.cable_types,function(val,index){
							if(val.id == id){
								$rootScope.cable_types.splice(index,1);
							}
						});
						$scope.list_all($rootScope.base_url);
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
	}

	$scope.edit_project_confirm = function(id){
		link = $rootScope.base_url+'/edit';

		$.ajax({
			url: link,
			type: 'POST',
			data: {
				name:$rootScope.form.name,
				id:$rootScope.form.id
			},
			success:function(data){
				if(data.status == 1){
			            $scope.message = data.message;  
			            $timeout(function() {
			             	$rootScope.message = '';
			             	$rootScope.dialogService.close('edit_project_modal');
			            }, 3000);
		            }else{
			            $rootScope.message_error_modal = data.message;  
			            if(typeof(data.errors._extras) != 'undefined'){
			           	      $rootScope.message_error_modal += data.errors._extras;
			            }     
			            angular.forEach(data.errors,function(val,index){
			           		$rootScope.form.error[index] = val;
			            });
			            $timeout(function() {
			              $rootScope.message_error_modal = '';
			            }, 3000);
			      }
			      $rootScope.$apply();
			}
		});
	}
	
	$scope.dateFormat = function(date){
		return Functions.date_format(date);
	}

	$scope.deploy_project = function(id,deployed){
		link = $rootScope.base_url+'/deploy';

		$.ajax({
			url: link,
			type: 'POST',
			data: {
				deploy:deployed,
				id:id
			},
			success:function(data){
				if(data.status == 1){
			            $scope.message_success = data.message;  
			            $timeout(function() {
			             	$rootScope.message_success = '';
			            }, 3000);
		            }else{
			            $rootScope.message_error = data.message;  
			            if(typeof(data.errors._extras) != 'undefined'){
			           	      $rootScope.message_error += data.errors._extras;
			            }     
			            $timeout(function() {
			              $rootScope.message_error = '';
			            }, 3000);
			      }
			      $rootScope.$apply();
			}
		});
	}


	$scope.delete_project = function(id){
		//abrir modal de deleção
		var options = {
			autoOpen: false,
			modal: true,
			title:'Atenção',
			width: 250,
			resizable:false,	
		};
		model = [];		
		$rootScope.msg_delete_project = $rootScope.Users.translateText('Deseja remover este projeto?');
		$rootScope.delete_project_count = 1;

		$rootScope.project_id = id;
		$rootScope.dialogService.open('delete_modal','delete_modal', model, options).then();	
		
	}



	$scope.getFilteredResults = function() {
	    return $scope.$eval("cable_type in cable_types = (contacts|filter:search|orderBy:['name']) | itemsPerPage : 10");
	}


	$scope.close = function(id){
		$rootScope.dialogService.close(id);
	}





});



