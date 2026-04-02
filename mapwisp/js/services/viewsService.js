app.service('Views', function($rootScope,dialogService,AccessPoints,Cables,Notes,Posts,Clients,Projects,Groups,Regions,Map,Reserves,$interval, $timeout){
	
	var self = {
		isLoading : false,
		viewSelected : '',

		list : function(id){
			self.isLoading = true,
			link = $rootScope.base_url+'/views/list_all'
			$.ajax({
				url: link,
				type: 'POST',
				success:function(data){
					self.views = data;
					self.viewSelected = '';
                    $rootScope.form = [];
                    $rootScope.form.optionView = 'add';
                    if(id){
                        self.viewSelected =  id;            
                    }
				},
				complete:function(){
					self.isLoading = false,
					$rootScope.$apply();
			        //Criar multiselect para views
			        $("#view-select").multiselect({
			        	multiple: false,
			        	header: "TELAS",
			        	noneSelectedText: 'TELAS',
			        	selectedText: "TELAS",
			        	selectedList: 1
			        });
			        $("#view-select").on("multiselectclick", function(event, ui) { 
			        	/* event: the original event object 
			        	 * ui.value: value of the checkbox 
			        	 * ui.text: text of the checkbox 
			        	 * ui.checked: whether or not the input was checked or unchecked (boolean) */ 
			        	if (ui.checked){
			        		$("#view-select").multiselect({selectedText: ui.text});
			        		self.select(ui.value);
			        	}
			        });
				}
			})  
		},

		select : function(id){
        	// id do projeto selecionado
        	self.viewSelected =  id;
            
            if(id){
            	self.autoSave(0);
                self.autoSave(1);
            }else{
                self.autoSave(0);
            }

            angular.forEach(self.views,function(view, index_view){
                if(view.id == self.viewSelected){
                    self.checkByView(view);
                    return;
                }
            })
        },

        /**
         * chack by View method
         * Gets the information of the view adn checks the right groups and projects. 
         * After checking, updates the items that are shown on screen
         * */
        checkByView : function(view){
        	//Groups.groupsChecked = view.groups;
        	//Groups.refreshCheckedBasedOnArrayViewChange();
        	//Projects.projectsChecked = view.projects;
        	//Projects.refreshCheckedBasedOnArray();
        	//self.refreshShowItems(view);
        	
        	//Above and commented is the old way. We would select all the groups, and all the projects, and then check which
        	// elements should be shown on the map, based on that
        	// the new way is to simply set the state of the treeview. That will show all the selected elements on the map.

        	//Can't select a state on the JsTree if it's not loaded yet
        	if ($rootScope.Nodes.isLoading){
        		return;
        	}
        	
        	var state = {};
        	state.core = {};
        	state.core.open = view.open;
        	state.checkbox = view.selected;
        	$rootScope.dont_save_nodes_on_db = true;
        	$rootScope.Nodes.deselect_all();
        	Map.setCenter(view.lat, view.lng, view.zoom);
			$timeout(function() {
	        	$('#jstree-sidebar-div').jstree().set_state(state);
	        	$rootScope.dont_save_nodes_on_db = false;
			}, 500);
        },
        
        /**
         * refresh Show Items
         * Method that sets the items of the selected groups and projects to be shown, and the others to be hidden
         * 
         * Depends on the selected/checked projects (their id's, to be precise) beein held on a variable called
         * projectsChecked, in the Projects service
         * */
        refreshShowItems : function(view){
        	//Cables
            angular.forEach(Cables.cables,function(cables,index_cat){
                angular.forEach(cables,function(cable, index_cable){
                    if(itemInArray(cable.project,Projects.projectsChecked)){
                        cable.polyline.setMap(Map.map);
                        cable.statusView = 1; 
                    }else{
                        cable.polyline.setMap(null);  
                        cable.statusView = 0;  
                    }
                })
            })
            //Posts
            angular.forEach(Posts.posts,function(post, index_post){
                if(itemInArray(post.project,Projects.projectsChecked)){
                    //post.dot.setMap(Map.map);
                    $rootScope.Markers.addToMap(post.dot);
                }else{
                    //post.dot.setMap(null);  
                    $rootScope.Markers.removeFromMap(post.dot);
                }
            }) 
            //AccessPoints
            angular.forEach(AccessPoints.accessPoints,function(aps,index_cat){                
                angular.forEach(aps,function(ap, index_ap){                                        
                    if(itemInArray(ap.project,Projects.projectsChecked)){
                        //ap.dot.setMap(Map.map);
                        $rootScope.Markers.addToMap(ap.dot);
                        ap.statusView = 1;
                        if (ap.circle && Map.viewAllCircles){
                        	//ap.circle.setMap(Map.map);
                        	$rootScope.Markers.addToMap(ap.circle);
                        }
                    }else{
                        //ap.dot.setMap(null);
                        $rootScope.Markers.removeFromMap(ap.dot);
                        ap.statusView = 0; 
                        if (ap.circle){
                        	//ap.circle.setMap(null);
                        	$rootScope.Markers.removeFromMap(ap.circle);
                        }
                    }
                })
            })
            //Notes
            angular.forEach(Notes.notes,function(note, index_note){
                if(itemInArray(note.project,Projects.projectsChecked)){
                    //note.marker.setMap(Map.map);
                    $rootScope.Markers.addToMap(note.marker);
                }else{
                    //note.marker.setMap(null); 
                    $rootScope.Markers.removeFromMap(note.marker);
                }
            }) 
           //Clients
            angular.forEach(Clients.clients,function(client, index_client){
                if(itemInArray(client.project,Projects.projectsChecked)){
                    //client.marker.setMap(Map.map);
                    $rootScope.Markers.addToMap(client.marker);
                }else{
                    //client.marker.setMap(null); 
                    $rootScope.Markers.removeFromMap(client.marker);
                }
            }) 
            //Regions
            angular.forEach(Regions.regions,function(region, index_region){  
                if(itemInArray(region.project,Projects.projectsChecked)){
                    //region.shape.setMap(Map.map);
                    $rootScope.Markers.addToMap(region.shape);
                    region.statusView = 1; 
                }else{
                    //region.shape.setMap(null); 
                    $rootScope.Markers.removeFromMap(region.shape);
                    region.statusView = 0; 
                }
            }) 
            //Reserves
            angular.forEach(Reserves.reserves,function(reserve, index_reserve){
                if(itemInArray(reserve.project,Projects.projectsChecked)){
                    //reserve.dot.setMap(Map.map);
                    $rootScope.Markers.addToMap(reserve.dot);
                    reserve.statusView = 1; 
                }else{
                    //reserve.dot.setMap(null); 
                    $rootScope.Markers.removeFromMap(reserve.dot);
                    reserve.statusView = 0; 
                }
            }) 
            
            //Se a chamada veio de uma selecao na view:
            if (view){
                //centralizar o mapa e dar zoom
            	//TODO Por enquanto chamando filter by view, para tambem mostrar itens que nao estao nos grupos.
            	//		(para nao assustar usuarios que ja estao acostumados com a forma antiga)
                //Map.setCenter(view.lat, view.lng, view.zoom);
            	self.filterByView(view);
            }
        },
        
        
        filterByView : function(view){

            angular.forEach(Cables.cables,function(cables,index_cat){
                angular.forEach(cables,function(cable, index_cable){
                    if(itemInArray(cable.id,view.cables)){
                        cable.polyline.setMap(Map.map);
                        cable.statusView = 1; 
                    }else if (cable.category != 4){
                        cable.polyline.setMap(null);  
                        cable.statusView = 0;  
                    }
                })
            })

            angular.forEach(Posts.posts,function(post, index_post){
                if(itemInArray(post.id,view.posts)){
                    post.dot.setMap(Map.map);
                }else{
                    post.dot.setMap(null);  
                }
            }) 


            angular.forEach(AccessPoints.accessPoints,function(aps,index_cat){                
                angular.forEach(aps,function(ap, index_ap){                                        
                    if(itemInArray(ap.id,view.access_points)){
                        ap.dot.setMap(Map.map);
                        ap.statusView = 1; 
                        if (ap.circle && Map.viewAllCircles){
                        	ap.circle.setMap(Map.map);
                        }
                    }else{
                        ap.dot.setMap(null);
                        ap.statusView = 0;
                        if (ap.circle){
                        	ap.circle.setMap(null);
                        }
                    }
                })
            })

            
            angular.forEach(Notes.notes,function(note, index_note){
                if(itemInArray(note.id,view.notes)){
                    note.marker.setMap(Map.map);                    
                }else{
                    note.marker.setMap(null);                      
                }
            }) 
           
            angular.forEach(Clients.clients,function(client, index_client){
                if(itemInArray(client.id,view.clients)){
                    client.marker.setMap(Map.map);                    
                }else{
                    client.marker.setMap(null);                      
                }
            }) 

            angular.forEach(Regions.regions,function(region, index_region){  
                if(itemInArray(region.id,view.regions)){
                    region.shape.setMap(Map.map);
                    region.statusView = 1; 
                }else{
                    region.shape.setMap(null); 
                    region.statusView = 0; 
                }
            }) 

            angular.forEach(Reserves.reserves,function(reserve, index_reserve){
                
                if(itemInArray(reserve.cable_id,view.cables)){
                    reserve.dot.setMap(Map.map);
                    reserve.statusView = 1; 
                }else{
                    reserve.dot.setMap(null); 
                    reserve.statusView = 0; 
                }
            }) 

            //centralizar o mapa e dar zoom
            Map.setCenter(view.lat, view.lng, view.zoom);
        },


        verify : function(){
            $rootScope.message_error_modal = '';
            if($rootScope.form.optionView == 'edit'){
                if(!self.viewSelected){
                    $rootScope.message_error_modal = 'Você deve selecionar uma tela'
					$timeout(function() {
						$rootScope.message_error_modal = '';
					}, 3000);
                    $rootScope.form.optionView = 'add';
                }else{
                    angular.forEach(self.views, function(el, index){
                        if(el.id == self.viewSelected){
                            $rootScope.form.name = el.name;
                        }
                    });
                }
            }
        },

        //Utilizado para salvar na hora, quando botao "Salvar estado atual" eh clicado
        save : function(){
        	if ($rootScope.Users.current_user.level > 1){
                if(self.viewSelected){
                	$rootScope.form.autoOptionView == 'edit'
                    self.addConfirm(true);
                }  
        	}
        },

        autoSave : function(status){
            if(status == 1){
            	//$('#jstree-sidebar-div').jstree().set_state(state);
            	if ($rootScope.Users.current_user.level > 1){
	                if(self.viewSelected){
	                    self.autoSaving = $interval(function() {
	                        $rootScope.form.autoOptionView == 'edit'
	                        self.addConfirm(true);
	                    }, 15000);
	                }  
            	}
            }else{
                 $interval.cancel(self.autoSaving);
            }
            
        },
        
        /*
         * On each select/deselect on the Treeview, this function is called, to update the nodes in the 
         * selected view. If no view is selected, nothing is done.
         * */
        updateViewNodes : function(elements, select){
        	if (!self.viewSelected || $rootScope.dont_save_nodes_on_db){
        		return;
        	}
        	if (select){
        		link = $rootScope.base_url+'/views/create_selected_nodes';
        	} else {
        		link = $rootScope.base_url+'/views/delete_selected_nodes';
        	}
        	//Only send ids:
        	var send_elements = [];
        	angular.forEach(elements, function(element, index){
        		var current_element = {};
        		current_element.id = element.id;
        		send_elements.push(current_element);
        	});
        	dataSend = {},
        	dataSend.nodes = send_elements;
        	dataSend.id = self.viewSelected;
        	$.ajax({
        		url: link,
        		type: 'POST',
        		data: dataSend,
        		success:function(data){

        		},
        		complete:function(){
        			
        		}
        	}) 
        },


        addConfirm : function(autosave){
            if(!autosave){
                self.isLoading = true;
            }
            dataSend = {};
            dataSend.access_points = [];
            dataSend.cables = [];
            dataSend.clients = [];
            dataSend.notes = [];
            dataSend.posts = [];
            dataSend.regions = [];
            dataSend.groups = [];
            dataSend.projects = [];
            dataSend.open = [];
            dataSend.selected = [];
            dataSend.checked = [];

            // towers = [];
            dataSend.name = $rootScope.form.name;
            dataSend.lat = Map.map.getCenter().lat();
            dataSend.lng = Map.map.getCenter().lng();
            dataSend.zoom = Map.map.getZoom();
            //Adding nodes
        	state = $('#jstree-sidebar-div').jstree().get_state();
        	angular.forEach(state.core.open, function(open, open_index){
        		dataSend.open.push(open);
        	});
//        	angular.forEach(state.core.selected, function(selected, selected_index){
//        		dataSend.selected.push(selected);
//        	});
        	angular.forEach(state.checkbox, function(checked, checked_index){
        		dataSend.selected.push(checked);
        	});

            if (!autosave){
            	$option = $rootScope.form.optionView;
            } else {
            	$option = $rootScope.form.autoOptionView;
            }
            
            if($option == 'add'){
                link = $rootScope.base_url+'/views/add';
            }else{              
                dataSend.id = self.viewSelected;
                link = $rootScope.base_url+'/views/edit';
                if(($rootScope.form.name) && (!autosave)){
                    dataSend.name = $rootScope.form.name;
                }else{
                    angular.forEach(self.views, function(el, index){
                        if(el.id == self.viewSelected){
                            dataSend.name = el.name;
                        }
                    });
                }
            }
            
        	
        	$rootScope.form.error = [];
        	$.ajax({
        		url: link,
        		type: 'POST',
        		data: dataSend,
        		success:function(data){
                    if(!autosave){  
                    	if($option == 'add'){
                    		$rootScope.set_errors_modal(data,'viewAdd'); 
                    	} else {
                    		$rootScope.set_errors_modal(data,'viewEdit'); 
                    	}
                        if(data.status == 1){
                            if($rootScope.form.optionView == 'add'){
                                self.list(self.viewSelected);
                            }else{
                                angular.forEach(self.views, function(view,index){
                                    if(view.id == dataSend.id){
                                        self.views[index]['name'] = dataSend.name;
                                        self.views[index]['lat'] = dataSend.lat;
                                        self.views[index]['lng'] = dataSend.lng;
                                        self.views[index]['zoom'] = dataSend.zoom;
                                    }
                                })
                            }

                        }
        			} else {
        				angular.forEach(self.views, function(view,index){
                            if(view.id == dataSend.id){
                                self.views[index]['name'] = dataSend.name;
                                self.views[index]['lat'] = dataSend.lat;
                                self.views[index]['lng'] = dataSend.lng;
                                self.views[index]['zoom'] = dataSend.zoom;
                                self.views[index]['open'] = dataSend.open;
                                self.views[index]['selected'] = dataSend.selected;
                                self.views[index]['checked'] = dataSend.checked;
                            }
                        })
        			}
         			
        		},
        		complete:function(){
        			self.isLoading = false;
	       			$rootScope.$apply();
        		}
        	})  
        },

        deleteConfirm: function(){
            self.isLoading = true;
            link = $rootScope.base_url+'/views/delete';

            $.ajax({
                url: link,
                type: 'POST',
                data: {id: self.viewSelected},
                success:function(data){                                  
                    $rootScope.set_errors_modal(data,'viewDelete');                        
                    if(data.status == 1){
                    	self.autoSave(0);
                        self.list();                        
                    }                    
                },
                complete:function(){
                    self.isLoading = false;
                    $rootScope.$apply();
                }
            })  
        },

        deleteSelected : function(){
            var options = {
                autoOpen: false,
                modal: true,
                title:'Atenção',
                width: 300,
                height:'auto',
                resizable:true,
                dialogClass: "noclose", 
            };
            model = [];  
            $rootScope.form = [];
            $rootScope.form.error = [];
            dialogService.open('viewDelete','viewDelete', model, options).then();
        },

        add : function(){
        	var options = {
        		autoOpen: false,
        		modal: true,
        		title:'Adicionar nova tela',
        		width: 300,
        		height:'auto',
        		resizable:true,
        		dialogClass: "noclose", 
        	};
        	model = [];  
        	$rootScope.form = [];
        	$rootScope.form.error = [];
        	$rootScope.form.optionView = "add";
        	dialogService.open('viewAdd','viewAdd', model, options).then();
        },
        
        edit : function(){
        	var options = {
        		autoOpen: false,
        		modal: true,
        		title:'Editar tela atual',
        		width: 300,
        		height:'auto',
        		resizable:true,
        		dialogClass: "noclose", 
        	};
        	model = [];  
        	$rootScope.form = [];
        	$rootScope.form.error = [];
            angular.forEach(self.views,function(view, index_view){
                if(view.id == self.viewSelected){
                	$rootScope.form.name = view.name;
                }
            })
        	$rootScope.form.optionView = "edit";
        	dialogService.open('viewEdit','viewEdit', model, options).then();
        }

    }
    
    return self;

})

function itemInArray(itemId, array){
    inside = false;
    angular.forEach(array,function(el,index){
        if(!inside){
            if(el == itemId){
                inside = true;
                return true;
            }    
        }        
    });

    return inside;
}