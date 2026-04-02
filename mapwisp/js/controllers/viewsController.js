

app.controller('ViewsController', function (Functions,$rootScope,$scope,$http,dialogService, $window,$element,Validation,$timeout, Views) {

	
	$rootScope.dialogService = dialogService;	

	//GOOGLE ANALYTICS------------------------------------------------------------------
	if ($rootScope.run_analytics){
	  (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
	  (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
	  m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
	  })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');
	  ga('create', 'UA-REPLACE-WITH-YOUR-ID', 'auto');
	  ga('set', 'page', '/views');
	  ga('send', 'pageview');
	}
	//GOOGLE ANALYTICS------------------------------------------------------------------

	$scope.list_all = function(link){ 
		$rootScope.base_url = link;

		$.ajax({
			url: link+'/list_all',
			type: 'POST',
			success:function(data){
				$rootScope.views = [];
				angular.forEach(data,function(val,index){
					view = val;	
					$rootScope.views.push(view);;

				});
				$rootScope.$apply();
			}	
		});	
	}

	
	/*
	 *This function exists because the original list_all also functions as init function for the controller
	 *So this one just assumes that init has already run
	 * */
	$scope.list_all_after = function(){ 
		$.ajax({
			url: $rootScope.base_url+'/list_all',
			type: 'POST',
			success:function(data){
				$rootScope.views = [];
				angular.forEach(data,function(val,index){
					view = val;	
					$rootScope.views.push(view);;

				});
				$rootScope.$apply();
			}	
		});	
	}

	$scope.close = function(id){
		$rootScope.dialogService.close(id);
	}

	
	
	
	$scope.edit_view = function(id){
		//abrrir modal de alteração		
		angular.forEach($rootScope.views,function(val,index){
			if(val.id == id){
				$rootScope.form = $rootScope.views[index];
			}
		});

	      var options = {
			autoOpen: false,
			modal: true,
			title:'Editar view',
			width: 300,
			resizable:false,	
			dialogClass: "noclose",	
		};
		model = [];	
		$rootScope.editing = true;
		$rootScope.dialogService.open('edit_view_modal','edit_view_modal', model, options).then();
	}



	$scope.delete = function(id){
        self.isLoading = true;
        link = $rootScope.base_url+'/delete';

        $.ajax({
            url: link,
            type: 'POST',
            data: {id: id},
            success:function(data){                                  
                $rootScope.set_errors_modal(data,'delete_modal');                        
                if(data.status == 1){
                    $scope.list_all_after();                        
                }                    
            },
            complete:function(){
                self.isLoading = false;
                $rootScope.dialogService.close('delete_modal');
                $rootScope.$apply();
            }
        });
	}

	$scope.edit_view_confirm = function(id){
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
			             	$rootScope.dialogService.close('edit_view_modal');
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


	$scope.delete_view = function(id){
		//abrir modal de deleção
		var options = {
			autoOpen: false,
			modal: true,
			title:'Atenção',
			width: 250,
			resizable:false,	
		};
		model = [];		
		$rootScope.msg_delete_view = 'Deseja remover esta view?';
		$rootScope.delete_view_count = 1;

		$rootScope.view_id = id;
		$rootScope.dialogService.open('delete_modal','delete_modal', model, options).then();	
		
	}

	$scope.close = function(id){
		$rootScope.dialogService.close(id);
	}

	$rootScope.set_errors_modal = function(data,modal_id,keep_open){
        if(data.status == 1){
          $scope.message_success_modal = data.message;  
          $timeout(function(){           
            $rootScope.message_success_modal = '';            
            if(!keep_open){
              $rootScope.dialogService.close(modal_id);  
            }            
          },1000);
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
          }, 1700);
        }
        $rootScope.$apply();
      }



});



