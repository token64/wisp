

app.controller('BackupsController', function (Functions,$rootScope,$scope,$http,dialogService, $window,$element,Upload,Validation,$timeout,$location) {

	
	$rootScope.dialogService = dialogService;	

	//GOOGLE ANALYTICS------------------------------------------------------------------
	if ($rootScope.run_analytics){
	  (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
	  (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
	  m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
	  })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');
	  ga('create', 'UA-REPLACE-WITH-YOUR-ID', 'auto');
	  ga('set', 'page', '/backups');
	  ga('send', 'pageview');
	}
	//GOOGLE ANALYTICS------------------------------------------------------------------

	$scope.list_all = function(link){ 	
		$rootScope.backups = [];
		$rootScope.base_url = link;
		$http.post(link+'/list_all').success(function(data){	
			$rootScope.backups = data;
		});	
	}

	$scope.close = function(id){
		$rootScope.dialogService.close(id);
		$rootScope.cond = 1;
	}




	$scope.add_backup = function(id){

		link = $rootScope.base_url+'/create';
		$.ajax({
			url: link,
			type: 'POST',
			success:function(data){
				if(data.status == 0){ 
	            		$rootScope.message_error = data.message;
	            		$timeout(function() {
						$rootScope.message_error = '';			      	
					}, 3000);	
					$scope.$apply();
	            	}else{  
					
					$scope.list_all($rootScope.base_url);		

					$rootScope.message_success = data.message;
										
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

	


	
	$scope.restore_backup = function(id,cond){
		//abrrir modal de alteração
   	      

   	      var options = {
			autoOpen: false,
			modal: true,
			title:'Atenção',
			width: 350,
			resizable:false,	
		};
		model = [];		
		$rootScope.backup_id = id;
		$rootScope.cond = 1;
		$rootScope.message_restore = 'Deseja realmente restaurar este backup? <br/>  Todos os dados modificados após a criação do backup serão perdidos';
		$rootScope.dialogService.open('restore_modal','restore_modal', model, options).then();
	}


	$scope.remove_backup = function(id){
		//abrrir modal de alteração
		  var options = {
			autoOpen: false,
			modal: true,
			title:'Atenção',
			width: 350,
			resizable:false,	
		};
		model = [];		
		$rootScope.backup_id = id;
		$rootScope.message = 'Deseja realmente  remover este backup? <br/>  O arquivo não poderá ser recuperado';
		$rootScope.dialogService.open('delete_modal','delete_modal', model, options).then();
	}


	$scope.remove_backup_confirm = function(id){


		link = $rootScope.base_url+'/remove';
		$.ajax({
			url: link,
			type: 'POST',
			data:{id:id},
			success:function(data){
				if(data.status == 0){ 
					$rootScope.message_error_modal = data.message;					
					$timeout(function() {
						$rootScope.message_error_modal = '';
					}, 3000);	
	            }else{  					
					$scope.list_all($rootScope.base_url);		
					$rootScope.message_success = data.message;				
					$timeout(function() {
						$rootScope.message_success = '';
					}, 3000);		
	            }
			},
			complete:function(){
				$scope.$apply();
				$rootScope.dialogService.close('delete_modal');							            		
			}
		})		
	}



	$scope.restore_backup_confirm = function(id,link_logout){

		

		switch($rootScope.cond){
			case 1:
				$rootScope.cond = 2;
				$rootScope.message_restore = 'Tem certeza? <br/>  Os dados novos não poderão ser recuperados';
				break;
			case 2:
				$rootScope.cond = 3;
				$rootScope.message_restore = 'Será criado um log informando que você fez esta restauração.<br/>Deseja continuar?';
				break;
			case 3:
				$rootScope.cond = 4;
				break;
			default:
				break;
		}


		if($rootScope.cond == 4){
						
			link = $rootScope.base_url+'/restore';
			$.ajax({
				url: link,
				type: 'POST',
				data:{id:id},
				success:function(data){
					
					
					if(data.status == 0){ 
		            		$rootScope.message_restore_error = data.message;
		            		
		            		$timeout(function() {
							$rootScope.message_restore_error = '';			      	
						}, 3000);	
						$scope.$apply();
		            	}else{ 
			            	$rootScope.message_restore_success = data.message;
		            		
		            		$timeout(function() {
							$rootScope.message_restore_success = '';			      	
							window.location.replace(link_logout); 

						}, 3000);	
						$scope.$apply();
								
		            	}

		            	
				},
				complete:function(){
					$scope.$apply();
												            		
				}
			})
		}		
	}

	
	

	


	$scope.date_format = function(val){		
		return Functions.date_format(val);		
	}	








});





