

app.controller('GroupsController', function (Functions,$rootScope,$scope,$http,dialogService, $window,$element,Validation,$timeout, Groups, Projects) {

	
	$rootScope.dialogService = dialogService;	



	$scope.list_all = function(link){ 
		$rootScope.base_url = link;
		$rootScope.Projects = Projects;
		Projects.list("edit");
		$.ajax({
			url: $rootScope.base_url+'/groups/list_all',
			type: 'POST',
			success:function(data){
				$rootScope.groups = [];
				angular.forEach(data,function(val,index){
					group = val;	
					$rootScope.groups.push(group);;

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
			url: $rootScope.base_url+'/groups/list_all',
			type: 'POST',
			success:function(data){
				$rootScope.groups = [];
				angular.forEach(data,function(val,index){
					group = val;	
					$rootScope.groups.push(group);;

				});
				$rootScope.$apply();
			}	
		});	
	}
	
	$scope.edit_group = function(id){
    	var options = {
        		autoOpen: false,
        		modal: true,
        		title:'Editar Grupo',
        		width: 300,
        		height:'auto',
        		resizable:true,
        		dialogClass: "noclose",
                close:function(){
                	Projects.list("select");     
                },
        	};
        	model = [];  
        	$rootScope.form = [];
        	$rootScope.form.error = [];
            angular.forEach($rootScope.groups,function(group, index_group){
                if(group.id == id){
                	$rootScope.form.name = group.name;
                	$rootScope.form.projects = [];
                	angular.forEach(group.projects, function(project, index_project){
                		$rootScope.form.projects.push("" + project.id);
                	});
                }
            })
        	$rootScope.form.optionGroup = "edit";
            $rootScope.group_id = id;
            //Listar projetos novamente, para  mostrar todas as opcoes no edit.
            Projects.list("edit");
        	dialogService.open('groupEdit','groupEdit', model, options).then();
	}
	
	$scope.edit_group_confirm = function(id){
		console.log("drinnen");
    	self.isLoading = true;
    	$rootScope.form.error = [];
    	dataSend = {};
    	dataSend.name = $rootScope.form.name;
    	dataSend.projects = {};
    	angular.forEach($rootScope.form.projects,function(project_id,index){
    		dataSend.projects[index] = {};
    		dataSend.projects[index]['id'] = project_id;
    	});

    	link = $rootScope.base_url+'/groups/edit';
    	dataSend.id = id;    	
    	$.ajax({
    		url: link,
    		type: 'POST',
    		data: dataSend,
    		success:function(data){
    			$rootScope.set_errors_modal(data,'groupEdit');
    			if(data.status == 1){
    				$scope.list_all_after();
    			}
    		},
    		complete:function(){
    			self.isLoading = false;
    			$rootScope.close('groupEdit')
       			$rootScope.$apply();
    		}
    	});
	}

	$scope.delete = function(id){
        self.isLoading = true;
        link = $rootScope.base_url+'/groups/delete';

        $.ajax({
            url: link,
            type: 'POST',
            data: {id: id},
            success:function(data){                                  
                // $rootScope.set_errors_modal(data,'delete_modal');                        
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
	
	$scope.delete_group = function(id){
		//abrir modal de deleção
		var options = {
			autoOpen: false,
			modal: true,
			title:'Atenção',
			width: 250,
			resizable:false,	
		};
		model = [];		
		$rootScope.msg_delete_group = $rootScope.Users.translateText('Deseja remover este grupo?');

		$rootScope.group_id = id;
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
          }, 1000);
        }
        $rootScope.$apply();
      }
	
	
});



