app.service('Posts', function (dialogService,$timeout,$rootScope,Map,$log,$http,Cables,Projects,$q,LevelsAndModes) {



    
    var self = {
        isLoading : false,
        posts : [],
        editing : false,
        addOnCable : false,
        viewAllPosts : 0,
        posts_loaded_width : "0%",
        bulkEdit : false,
        bulkUndeploy : false,
        bulkDeploy : false,
        arrPostGroups : [],

        materialToPost : function(){            
            $rootScope.form.error = [];
            if(!$rootScope.form.material_selected){
                $rootScope.form.error.materials = $rootScope.Users.translateText('Selecione o material para adicionar');
                return; 
            }


            dataSend = {};
            dataSend.materials = {};
            dataSend.id = self.currentPostOpen.id;
            dataSend.materials[$rootScope.form.material_selected] = $rootScope.form.material_post_quantity;
            self.isLoading = true;

            $.ajax({
                url: $rootScope.base_url+'/posts/add_materials',
                type: 'POST',
                data: dataSend,
                success:function(data){            
                    $rootScope.set_errors_modal(data,'postOpen',true);
                    self.findMaterialPost(self.currentPostOpen).then(function(){
                        self.isLoading = false;
                        $rootScope.form.material_post_quantity = 1;
                        $rootScope.form.kit_post_quantity = 1;
                        $rootScope.form.id = post.id;
                    
                        $rootScope.$apply();
                    });
                    
                },
                complete:function(){
                    
                }
            })

        },

        kitToPost : function(){
            // /posts/add_materials/
            $rootScope.form.error = [];
            if(!$rootScope.form.kit_selected){
                $rootScope.form.error.kits = $rootScope.Users.translateText('Selecione o kit para adicionar');
                return; 
            }


            dataSend = {};
            dataSend.kits = {};
            dataSend.id = $rootScope.form.id;
            dataSend.kits[$rootScope.form.kit_selected] = $rootScope.form.kit_post_quantity;
            self.isLoading = true;

            $.ajax({
                url: $rootScope.base_url+'/posts/add_materials',
                type: 'POST',
                data: dataSend,
                success:function(data){            
                    $rootScope.set_errors_modal(data,'postOpen',true);
                    self.findMaterialPost(post).then(function(){
                        self.isLoading = false;
                        $rootScope.form.material_post_quantity = 1;
                        $rootScope.form.kit_post_quantity = 1;
                        $rootScope.form.id = post.id;  
                        
                        $rootScope.$apply();
                    });
                },
                complete:function(){
                    
                }
            })

        },


        delete_material_post : function(postId,materialId){
            self.isLoading = true;
        	$.ajax({
        		url: $rootScope.base_url+'/posts/delete_material',
        		type: 'POST',
        		data: {id:postId,material_type_id:materialId},
        		success:function(data){            
        			$rootScope.set_errors_modal(data,'postOpen',true);
        			self.findMaterialPost(self.currentPostOpen).then(function(){
                        self.isLoading = false;
                        $rootScope.form.material_post_quantity = 1;
                        $rootScope.form.kit_post_quantity = 1;
                        $rootScope.form.id = post.id;                    
                        $rootScope.$apply();
                    });
        		
				},
        		complete:function(){
        			
        		}
        	});
        },

        open : function(post){
            self.isLoading = true;

            self.findMaterialPost(post).then(function(){
                var options = {
                    autoOpen: false,
                    modal: true,
                    title: $rootScope.Users.translateText('Poste de estrutura'),
                    width: 700,
                    height: 500,
                    resizable:true,
                    close: function(){
                    	self.currentPostOpen = null;
                    },
                };
                model = []; 

                $rootScope.form = [];
                $rootScope.form.error = [];
                $rootScope.form.material_post_quantity = 1;
                $rootScope.form.kit_post_quantity = 1;
                $rootScope.form.id = post.id;
                self.currentPostOpen = post;
                
                self.isLoading = false;
                dialogService.open('postOpen','postOpen', model, options).then();
                dialogService.close('menuPost');
            });
                        
        },

        findMaterialPost : function(post){
            var d = $q.defer();
            $rootScope.message_success_modal = '';
            $rootScope.message_error_modal = '';
            $.ajax({
                url: $rootScope.base_url+'/posts/list_materials',
                type: 'POST',
                data: {id:post.id},
                success:function(data){      
                    self.materialsPost = [];
                    self.materialsPost = data;
                	// Set post icon accordingly
                    if (self.materialsPost.length > 0){
                    	if (post.deploy_information.deployed){
                    		post.dot.setIcon($rootScope.base_url+"/img/icons_map/poste_mat_deployed.png");
                    	} else {
                    		post.dot.setIcon($rootScope.base_url+"/img/icons_map/poste_mat.png");
                    	}
                    } else {
                    	if (post.deploy_information.deployed){
                    		post.dot.setIcon($rootScope.base_url+"/img/icons_map/poste_deployed.png");
                    	} else {
                    		post.dot.setIcon($rootScope.base_url+"/img/icons_map/poste.png");
                    	}
                    }
                    d.resolve();                                    
                },
            })     
            return d.promise;  
        },

        changeMaterialQuantity : function(postId,materialId,quantity){
            $rootScope.message_success_modal = '';
            $rootScope.message_error_modal = '';
            $.ajax({
                url: $rootScope.base_url+'/posts/edit_material',
                type: 'POST',
                data: {id:postId,material_type_id:materialId,quantity:quantity},
                success:function(data){      
                    if(data.status == 0){
                          $rootScope.set_errors_modal(data,'postOpen',true);    
                    }                                   
                },
            })     
        },

        edit : function(bulk){
            self.isLoading = true;
            
			$rootScope.form = [];
            $rootScope.form.error = [];
            $rootScope.form.bulk = bulk;

            if(!self.bulkEdit){

				$rootScope.form.id = self.selectedPost.id;
				$rootScope.form.identifier = self.selectedPost.identifier;
				$rootScope.form.id_concessionaria = self.selectedPost.id_concessionaria;
				$rootScope.form.group_identifier = self.selectedPost.group_identifier;
				$rootScope.form.owner = self.selectedPost.owner;
				$rootScope.form.price_month = self.selectedPost.price_month;
				$rootScope.form.name = self.selectedPost.name;
				$rootScope.form.lat = self.selectedPost.dot.position.lat();
				$rootScope.form.lng = self.selectedPost.dot.position.lng();
				$rootScope.form.color = self.getPostColor(self.selectedPost);

            }else{
                $rootScope.Nodes.getTreeViewFolders();
            }

			var options = {
				autoOpen: false,
				modal: true,
				title: $rootScope.Users.translateText('Editar poste'),
				width: 500,
				height: 510,
				resizable:true,
				close: function(){
					self.currentPostOpen = null;
					//limpa dots da tela
					if(self.bulkEdit){
						self.bulkEdit = false;
                        self.bulkDeploy = false;
						self.bulkUndeploy = false;
                        $rootScope.dotsCount = $rootScope.dotsTemp.length;
					}
				},
			};
			model = []; 

			if(dialogService.isOpen('menuPost')){
			    dialogService.close('menuPost'); 
			}

			self.isLoading = false;
			dialogService.open('Editposts','Editposts', model, options).then(function() {
                setTimeout(function() {
					$("#select-folder-posts").selectize();
				}, 1000);
            }); 
                        
        },

        editCancel : function(){

				dialogService.close('Editposts');
			
        },
        
        editConfirm : function(bulk){

            dataSend = {};
            dataSend.dot = {};
            dataSend.id = $rootScope.form.id;
            dataSend.identifier = $rootScope.form.identifier;
            dataSend.id_concessionaria = $rootScope.form.id_concessionaria;
            dataSend.group_identifier = $rootScope.form.group_identifier;
            dataSend.owner = $rootScope.form.owner;
            dataSend.price_month = $rootScope.form.price_month;
            dataSend.name = $rootScope.form.name;
            dataSend.dot.lat = $rootScope.form.lat;
            dataSend.dot.lng = $rootScope.form.lng;
			dataSend.color = $rootScope.form.color;

            $.ajax({
                url: $rootScope.base_url+'/posts/edit',
                type: 'POST',
                data: dataSend,
                success:function(data){
                    
                    $rootScope.Posts.posts.filter(p => p.id === $rootScope.form.id).forEach(post =>{
                    	
                    	$rootScope.Markers.removeFromMap(self.selectedPost.dot, $rootScope.Markers.postsMarkerCluster);

                    	var cables = data.data.dot.cables;

						cables.filter(c => c).forEach(cable =>{
							$rootScope.Cables.redrawCable(cable.id, false);
						});

                    });

                    $rootScope.Nodes.changeNodeName(5, $rootScope.form.id, $rootScope.form.name);

                    $rootScope.$apply();
                    $rootScope.set_errors_modal(data,'Editposts',true);
                },
                complete:function(){        			
                    dialogService.close('Editposts');
                    $rootScope.$digest();
                }
            });
            
        },

        redrawPost : function(post){

			if(post.deploy_information.deployed){
				if (post.material_types && post.material_types.length > 0){
					//dot = Map.drawMarker(post.dot.lat, post.dot.lng,post.dot.id,'poste_mat.png', post.name,'',1);
                    dot = Map.drawSVGMarker(post.dot.lat, post.dot.lng, "poste_mat", post.name,
                        "Poste", post.deploy_information.deployed, self.getPostColor(post), "black");
				} else {
					//dot = Map.drawMarker(post.dot.lat, post.dot.lng,post.dot.id,'poste.png', post.name,'',1);
                    dot = Map.drawSVGMarker(post.dot.lat, post.dot.lng, "poste", post.name,
                        "Poste", post.deploy_information.deployed, self.getPostColor(post), "black");
				}
			}else{
				if (post.material_types && post.material_types.length > 0){
					//dot = Map.drawMarker(post.dot.lat, post.dot.lng,post.dot.id,'poste_mat.png', post.name,'',0);
                    dot = Map.drawSVGMarker(post.dot.lat, post.dot.lng, "poste_mat", post.name,
                        "Poste", post.deploy_information.deployed, self.getPostColor(post), "black");
				} else {
					//dot = Map.drawMarker(post.dot.lat, post.dot.lng,post.dot.id,'poste.png', post.name,'',0);
                    dot = Map.drawSVGMarker(post.dot.lat, post.dot.lng, "poste", post.name,
                        "Poste", post.deploy_information.deployed, self.getPostColor(post), "black");
				}
			}

			dot.id = post.dot_id;
			dot.postId = post.id;
			
			if(LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR]) || LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO])){
				dot.setDraggable(true);
			} else {
				dot.setDraggable(false);
			}

			$rootScope.Markers.addToMap(dot, $rootScope.Markers.postsMarkerCluster);

            post.dot = dot;
			Map.addListenerPost(post); 

			return post;

        },

        bulkEditConfirm : function(){

			self.isLoading = true;
			$rootScope.$evalAsync();

			var posts = $rootScope.Posts.posts.filter(obj => google.maps.geometry.poly.containsLocation(new google.maps.LatLng(obj.dot.position.lat(), obj.dot.position.lng()), $rootScope.shapeTemp));
            
            if(posts.length === 0){
            	$rootScope.message_error_modal = $rootScope.Users.translateText("Tipo não encontrado");
				self.isLoading = false;
				return;
            }

            var arrItems = {};
			var contIndex = 0;

			posts.forEach(post =>{

                //verifica se o item está visivel
				if(!$rootScope.Markers.markerOnMap(post.dot)){
					return;
				}

				var item = {};
				$rootScope.form.error = [];

				if ($rootScope.form.name){
				    item.name = $rootScope.form.name;
				    post.name = $rootScope.form.name;
				}

				if ($rootScope.form.owner){
                    item.owner = $rootScope.form.owner;
                    post.owner = $rootScope.form.owner;
                }

                if ($rootScope.form.price_month){
                    item.price_month = $rootScope.form.price_month;
                    post.price_month = $rootScope.form.price_month;
                }

				if ($rootScope.form.identifier){
                    item.identifier = $rootScope.form.identifier;
                    post.identifier = $rootScope.form.identifier;
                }

				if ($rootScope.form.id_concessionaria){
                    item.id_concessionaria = $rootScope.form.id_concessionaria;
                    post.id_concessionaria = $rootScope.form.id_concessionaria;
                }

				if ($rootScope.form.group_identifier){
                    item.group_identifier = $rootScope.form.group_identifier;
                    post.group_identifier = $rootScope.form.group_identifier;
                }

                if ($rootScope.form.color){
                    item.color = $rootScope.form.color;
                    post.color = $rootScope.form.color;
                }

                item.changeDeployed = false;
                
                //deploys
                if(self.bulkUndeploy && post.deploy_information.deployed){
                	item.changeDeployed = true;
                    item.deployed = false;
					post.deploy_information.deployed = false;
				}else if(self.bulkDeploy && !post.deploy_information.deployed){
					item.changeDeployed = true;
                    item.deployed = true;
					post.deploy_information.deployed = true;
                }

				item.changeFolder = false;

				if ($('#select-folder-posts').val()){
					
					var node = [];
					
					if(node = $rootScope.Nodes.nodes.find(n=>n.post_id === post.id)){
						item.node_id = node.id;
						item.parent_id = parseInt($('#select-folder-posts').val());
	                    item.changeFolder = true;
					}					
                    
                }
                
                item.id = post.id;

				arrItems[contIndex] = item;
				contIndex++;

            });

            edit_many(arrItems);

            function edit_many(items) {
				self.isLoading = true;
				var dataSend = JSON.stringify(items);          
				$.ajax({
					url: $rootScope.base_url+'/posts/edit_many',
					type: 'POST',
					data: {data:dataSend},
					dataType: "json",
					success:function(data){
						if(data.status == 1){

                            $rootScope.message_success_modal = data.message;
                            self.isLoading = false;
                            location.reload(true);
						}              
					},
					error: function(data){
						$rootScope.message_error_modal = data.message;
						console.log(data);
						self.isLoading = false;
					},
					complete:function(){
						
						$rootScope.$digest();
					}
				});
		   }

		},

        deploy : function(post){            

            if(post.deploy_information.deployed){
                deploy = 0;
            }else{
                deploy = 1;
            }
            self.isLoading = true;
            $.ajax({
                url: $rootScope.base_url+'/posts/deploy',
                type: 'POST',
                data: {id:post.id,deployed:deploy},
                success:function(data){            
                    if(data.status == 0){
                        var options = {
                            autoOpen: false,
                            modal: true,
                            title:'Atenção',
                            width: 300,
                            height:'auto',
                            resizable:true,
                            dialogClass: "noclose", 
                        };
                        $rootScope.messageAlert = '<h6>'+data.message+'</h6>'
                        model = [];  
                    }else{
                        post.deploy_information.deployed = deploy;
                        if(deploy){
                        	if (post.material_types && post.material_types.length > 0){
                        		post.dot.setIcon($rootScope.base_url+"/img/icons_map/poste_mat_deployed.png");
                                post.dot.setDraggable(false);
                            } else {
                                post.dot.setIcon($rootScope.base_url+"/img/icons_map/poste_deployed.png");
                                post.dot.setDraggable(false);
                        	}
                        }else{
                        	if (post.material_types.length > 0){
                        		post.dot.setIcon($rootScope.base_url+"/img/icons_map/poste_mat.png");
                        	} else {
                        		post.dot.setIcon($rootScope.base_url+"/img/icons_map/poste.png");
                        	}
                        }
                    }            
                },
                complete:function(){
                    self.isLoading = false;
                    self.menuPost = false;  
                    if(dialogService.isOpen('menuPost')){
                        dialogService.close('menuPost');
                    }
                    $rootScope.$digest();
                }
            })
        },


        



        delete : function(id,category){
            var options = {
                autoOpen: false,
                modal: true,
                title: $rootScope.Users.translateText('Atenção'),
                width: 300,
                height:'auto',
                resizable:true,
                dialogClass: "noclose", 
            };
            
            self.menuPost = false;  
            dialogService.close('menuPost'); 

            model = [];  
            self.postSelected = post;                    
            dialogService.open('postDelete','postDelete', model, options).then();
        },



        deleteConfirm : function(post_id, synchronous){
        	var async = true;
        	var set_errors = true;
        	if (synchronous){
        		async = false;
        		set_errors = false;
        	}
        	self.isLoading = true;

        	link = $rootScope.base_url+'/posts/delete';
        	$.ajax({
        		url: link,
        		type: 'POST',
        		data: {id:post_id},
        		async: async,
        		success:function(data){
        			if (set_errors){
        				$rootScope.set_errors_modal(data,'postDelete');
        			}
        			if(data.status == 1){
        				angular.forEach(self.posts,function(el,index){
        					if(el.id == post_id){
        						//el.dot.setMap(null);
        						$rootScope.Markers.removeFromMap(el.dot, $rootScope.Markers.postsMarkerCluster);
        						self.posts.splice(index,1);
        						return;
        					} 
        				});  
        				//Remove post from treeview
        				self.removePostFromTreeView(post_id);
        			}
        		},
        		complete:function(){
        			self.isLoading = false; 
        			self.postSelected = false;  
        		}
        	})  
        },

		removePostFromTreeView : function(post_id){
			//Remove node from DB
			var remove_node_id = null;
			var i;
            for (i = 0; i < $rootScope.Nodes.nodes.length; i++){
				if ($rootScope.Nodes.nodes[i].post){
					if ($rootScope.Nodes.nodes[i].post_id == post_id){
						remove_node_id = $rootScope.Nodes.nodes[i].id;
					}
				}else if($rootScope.Nodes.nodes[i].data){
					if ($rootScope.Nodes.nodes[i].data.post_id == post_id){
						remove_node_id = $rootScope.Nodes.nodes[i].data.id;
					}
				}
			}
			var data = {};
			data.id = remove_node_id;
			//Remove drom tree view
			$rootScope.Nodes.deleteNodeFromTree(remove_node_id);
			//Remove node from DB
			$rootScope.Nodes.deleteNode(data);
        },
        
        separePostFromCable : function(){
            
            var options = {
                autoOpen: false,
                modal: true,
                title: $rootScope.Users.translateText('Atenção'),
                width: 300,
                height:'auto',
                resizable:true,
                dialogClass: "noclose", 
            };
            
            self.menuPost = false;  
            dialogService.close('menuPost'); 

            model = [];                   
            dialogService.open('postSeparateFromCable','postSeparateFromCable', model, options).then();

        },
        
        separatePostFromCableConfirm : function(){

            var dataSend = {};

            dataSend.dot_id = self.selectedPost.dot.id;

            link = $rootScope.base_url+'/posts/separate_from_cable';
            $.ajax({
                url: link,
                type: 'POST',
                data: dataSend,
                success:function(data){
                	Cables.redrawCable(data.data.cable_id,false);
                	dialogService.close('postSeparateFromCable');
                }
            });

        },
    
        list : function(show){
            self.isLoading = true;
            link = $rootScope.base_url+'/posts/list_all'
            $.ajax({
                url: link,
                type: 'POST',
                success:function(response){
                	self.posts_loaded_width = response.percentage + "%";
                    self.organize_post_data(response.data, show);
                	$rootScope.$apply();
                	
                	if (response.all_data_loaded){
						self.isLoading = false;
						// OPTIMIZATION: Build lookup map for O(1) post access in search
						self.buildPostsLookupMap();
						//After listing all, notify treeview nodes service
						$rootScope.Nodes.everythingLoaded("posts");

					} else {
						//There was too much data to get in one request, so start incremental load now.
                		self.list_incrementally(response.offset, show);
					}
                }               
            });

            
        },

        list_incrementally : function(offset, show){
        	 link = $rootScope.base_url+'/posts/list_all'
             $.ajax({
                 url: link,
                 data: {offset : offset},
                 type: 'POST',
                 success:function(response){ 
                	self.posts_loaded_width = response.percentage + "%";
                    self.organize_post_data(response.data, show);
                 	$rootScope.$apply();
                 	
                 	if (response.all_data_loaded){
						self.isLoading = false;
						// OPTIMIZATION: Build lookup map for O(1) post access in search
						self.buildPostsLookupMap();
						//After listing all, notify treeview nodes service
						$rootScope.Nodes.everythingLoaded("posts");

                        // @bruno - 10/01/2021 - Desabling server cache for now
						// Send an extra request to cache all the posts
						// cache_link = $rootScope.base_url+'/posts/cache_all'
						// $.ajax({
						// 	url: cache_link,
						// 	type: 'POST',
						// 	success:function(response){}
						// });
					} else {
						//There was too much data to get in one request, so start incremental load now.
                		self.list_incrementally(response.offset, show);
					}
                 }               
             }) 
        },
        
        organize_post_data : function(data, show){
        	angular.forEach(data,function(el,index){
                if(el.dot){
                    post = [];
                    post.dot = [];
                    post.id = el.id; 
                    post.name = el.name; 
                    post.identifier = el.identifier;
                    post.id_concessionaria = el.id_concessionaria;
                    post.group_identifier = el.group_identifier;
                    post.owner = el.owner;
                    post.price_month = el.price_month;
                    //post.project = el.dot.projects[0];
                    post.deploy_information = el.deploy_information; 
                    post.material_types = el.material_types;
					post.color = el.color;

                    if(!self.arrPostGroups.find(t=>t.group_identifier === post.group_identifier)){

                        self.arrPostGroups.push(post);
                            
                    }

                    var post_name = "";
                    if(el.name != ''){
                        post_name = el.name;
                    }else{
                        post_name = $rootScope.Users.translateText('Poste de estrutura');
                    }

                    if(el.dot){
                    	if(el.deploy_information.deployed){
                    		if (post.material_types.length > 0){
                    			//dot = Map.drawMarker(el.dot.lat, el.dot.lng,el.dot.id,'poste_mat.png', post_name,'',1);
                                //Draw a marker for the building
                                dot = Map.drawSVGMarker(el.dot.lat, el.dot.lng, "poste_mat", post_name,
                                    "Poste", el.deploy_information.deployed, self.getPostColor(el), "black");
                    		} else {
                    			//dot = Map.drawMarker(el.dot.lat, el.dot.lng,el.dot.id,'poste.png', post_name,'',1);
                                dot = Map.drawSVGMarker(el.dot.lat, el.dot.lng, "poste", post_name,
                                    "Poste", el.deploy_information.deployed, self.getPostColor(el), "black");
                    		}
                    	}else{
                    		if (post.material_types.length > 0){
                    			//dot = Map.drawMarker(el.dot.lat, el.dot.lng,el.dot.id,'poste_mat.png', post_name,'',0);
                                dot = Map.drawSVGMarker(el.dot.lat, el.dot.lng, "poste_mat", post_name,
                                    "Poste", el.deploy_information.deployed, self.getPostColor(el), "black");
                    		} else {
                    			//dot = Map.drawMarker(el.dot.lat, el.dot.lng,el.dot.id,'poste.png', post_name,'',0);
                                dot = Map.drawSVGMarker(el.dot.lat, el.dot.lng, "poste", post_name,
                                    "Poste", el.deploy_information.deployed, self.getPostColor(el), "black");
                    		}
                    	}
                    }
                    if(show){
                        //dot.setMap(Map.map);
                        $rootScope.Markers.addToMap(dot, $rootScope.Markers.postsMarkerCluster);
                    }else{
                        //dot.setMap(null); 
                        $rootScope.Markers.removeFromMap(dot, $rootScope.Markers.postsMarkerCluster);
                    }
                    
                    dot.id = el.dot_id;
                    dot.postId = el.id;
                    if((LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR]) || 
                    LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO])) 
                    && ((!post.deploy_information.deployed))){
                    	dot.setDraggable(true);
                    } else {
                    	dot.setDraggable(false);
                    }

                    if(post.sharedDatabase){
						dot.setDraggable(false);
					}

                    post.dot = dot;
                    Map.addListenerPost(post); 
                    //console.log(post);
                    self.posts.push(post);                      
                }
            });
        },

        /**
		 * Build lookup map for O(1) post access by ID
		 * OPTIMIZATION: Creates a map for fast post lookup during search operations
		 */
		buildPostsLookupMap: function() {
			$rootScope.Posts.postsMap = {};
			angular.forEach(self.posts, function(post) {
				if (post.id) {
					$rootScope.Posts.postsMap[post.id] = post;
				}
			});
		},

        /**
		 * 
		 * @param {*} post 
		 */
		getPostColor: function (post) {
			if (!post.color) {
				// If no color is set, set default grey
				post.color = "#c0c0c0";
			}
			return post.color;
		},
        
        /*
         * PROTOTYPE function, to add many posts at once -> could be used for KMZ/KML imports.
         * */
        add_many : function(posts){
        	self.isLoading = true;
        	link = $rootScope.base_url+'/posts/add_many'; 
        	var dataSend = JSON.stringify(posts);          
        	$.ajax({
                url: link,
                type: 'POST',
                data: {data:dataSend,saving_node_id: $rootScope.Nodes.saving_node_id},
                dataType: "json",
                success:function(data){
                    if(data.status == 1){

                    	self.isLoading = false;
                    	location.reload(true);
                    }              
                },
                error: function(data){
                	console.log(data);
                	self.isLoading = false;
                },
                complete:function(){
                    
                    $rootScope.$digest();
                }
            })
        },

        /**
         * Add method
         * Opens a modal with a form to add a post
         * */
        add : function(){
            var options = {
                    autoOpen: false,
                    modal: true,
                    title: $rootScope.Users.translateText("Adicionar Poste"),
                    width: 400,
                    height:'auto',
                    resizable:true,
                    dialogClass: "noclose", 
                    position: {
                        my: "center",
                        at: "center",
                        of: window,
                        collision: "none"
                    },
                    close:function(){
                        $rootScope.form = [];
                    }    
                };
                model = [];
                $rootScope.form = [];
                $rootScope.form.error = [];

                $rootScope.form.name = $rootScope.Users.translateText('Poste de estrutura')
                
                if($rootScope.menuMap){
                        $rootScope.menuMap = false;       
                        $rootScope.dialogService.close('menuMap');
                }
                dialogService.open('postAdd','postAdd', model, options).then();
        },

        addConfirm : function(){
        	Cables.usingPositionOnCable = true;
            self.isLoading = true;
            var dataSend = {};
            dataSend.dot = {};  
            created_entity = null;        
            //dataSend.dot.projects = {};
            //dataSend.dot.projects._ids = [];

            dataSend.name = $rootScope.form.name;
            dataSend.color = "#c0c0c0";
            
            if(!Map.KmzKmlImporting){
                dataSend.color = $rootScope.form.color;
            }
            
            if (!Map.serialAdding){
            	$rootScope.form = [];
            	$rootScope.form.error = [];
            }            
            
            if(Cables.positionOnCable && Cables.cableSelected){
                self.addOnCable = true;
                dataSend.cable = {};

                //dataSend.project = parseInt(Projects.projectSelected);  
                dataSend.cable = Cables.cableSelected.id;
                dataSend.dot.lat = Cables.positionOnCable.event.latLng.lat();
                dataSend.dot.lng = Cables.positionOnCable.event.latLng.lng(); 
                dataSend.prev_dot = {};

                if(Cables.positionOnCable.positioning == 'begin'){
                    dataSend.dot.id = Cables.positionOnCable.dot_id;
                    dataSend.next_dot = Cables.positionOnCable.next_dot;
                    dataSend.position = 1;
                }
                if(Cables.positionOnCable.positioning == 'end'){
                    dataSend.dot.id = Cables.positionOnCable.dot_id;
                    //when the var "positionOnCable" is populated, and the position is 'end', the var to describe the previous dot is called prev_dot
                    dataSend.prev_dot = Cables.positionOnCable.prev_dot;
                    dataSend.position = 3;
                }
                if(Cables.positionOnCable.positioning == 'middle'){
                    //when the var "positionOnCable" is populated, and the position is 'middle', the var to describe the previous dot is called prevDot
                    dataSend.prev_dot = Cables.positionOnCable.prevDot.id;
                    dataSend.position = 2;
                }
                Cables.positionOnCable = false;                                                 
            }else{
            	self.addOnCable = false;
                //dataSend.dot.projects._ids.push(Projects.projectSelected);
				if (Map.serialAdding || Map.KmzKmlImporting){
					dataSend.dot.lat = $rootScope.current_position.lat;
					dataSend.dot.lng = $rootScope.current_position.lng; 	
				} else {
					dataSend.dot.lat = $rootScope.event.latLng.lat();
					dataSend.dot.lng = $rootScope.event.latLng.lng(); 
				}
            }
            Cables.usingPositionOnCable = false;

            if(self.addOnCable){
                link = $rootScope.base_url+'/posts/add_on_cable' 
            }else{
                link = $rootScope.base_url+'/posts/add'
            }           

	        //KMZ Vars
			if ($rootScope.last_kmz_point){
				last_kmz_point = true;
			} else {
				last_kmz_point = false;
			}
			
			if (Map.KmzKmlImporting){
				KmzKmlImporting = true;
			} else {
				KmzKmlImporting = false;
			}
           //-----------------------------

            $.ajax({
                url: link,
                type: 'POST',
                data: dataSend,
                success:function(data){
                    if(data.status == 1){
                       created_entity = data.data;
                        if(self.addOnCable){
                            Cables.redrawCable(Cables.cableSelected.id,false);
                        }
                        post = [];
                        post.dot = [];

                                //post.project = data.dot.projects[0]['id'];
                        post.id = created_entity.id;                
                        post.deploy_information = created_entity.deploy_information; 
                        post.name = created_entity.name; 

                                
                        if(created_entity.dot){   
                            //if(created_entity.deploy_information.deployed){
                            //    dot = Map.drawMarker(created_entity.dot.lat, created_entity.dot.lng,created_entity.dot.id,'poste.png', created_entity.name,'',1);                    
                            //} else{
                            //    dot = Map.drawMarker(created_entity.dot.lat, created_entity.dot.lng,created_entity.dot.id,'poste.png', created_entity.name,'',0);                     
                            //}

                            dot = Map.drawSVGMarker(created_entity.dot.lat, created_entity.dot.lng, "poste", created_entity.name,
                                "Poste", created_entity.deploy_information.deployed, self.getPostColor(created_entity), "black");

                            dot.id = created_entity.dot_id;
                            dot.postId = created_entity.id;
                            if(LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR]) || LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO])){
                                dot.setDraggable(true);
                            } else {
                                dot.setDraggable(false);
                            }
                            //dot.setMap(Map.map);
                            $rootScope.Markers.addToMap(dot, $rootScope.Markers.postsMarkerCluster);
                        }                 

                        post.dot = dot;               
                        Map.addListenerPost(post);

                        self.posts.push(post); 

                        if($rootScope.menuMap){
                            $rootScope.menuMap = false;       
                            $rootScope.dialogService.close('menuMap');
                        }
                        self.addPostTreeView(post.id, post.name, self.posts.length - 1);
                        
                        if($rootScope.dialogService.isOpen("postAdd")){
                            $rootScope.dialogService.close("postAdd");
                        }
                           
                        if($rootScope.menuCable){
                            $rootScope.menuCable = false;       
                            $rootScope.dialogService.close('menuCable');
                        }
	       	            if (last_kmz_point){
	 						$rootScope.message_success = $rootScope.Users.translateText('Todos os itens KMZ foram importados');
	 						setTimeout(function() {
	 						    $rootScope.message_success = '';
	 						}, 4000);
	 				          Map.isLoading = false;
	 				          $rootScope.last_kmz_point = false;
	       	               }
                        $rootScope.$digest();                         
                    } else {
						var options = {
							autoOpen: false,
							modal: true,
							title: $rootScope.Users.translateText("Atenção"),
							width: 300,
							height:"auto",
							resizable:true,
							dialogClass: "noclose alertModal", 
						};
						$rootScope.messageAlert = $rootScope.Users.translateText(data.message);
						model = [];  
						$rootScope.dialogService.open("alertModal","alertModal", model, options).then();
					}              
                },
                complete:function(){
                    self.isLoading = false;
                    $rootScope.$digest();
                }
            })
        },

        addPostTreeView : function(id, name, tomo_index){
			node_data = {};
			node_data.parent_id = $rootScope.Nodes.saving_node_id;
			node_data.leaf = 1;
			node_data.selected = 1;
			node_data.checked = 1;
			node_data.category = 5;
			node_data.post_id = id;
			
			var tomo_node_id = $rootScope.Nodes.addSync(node_data);
			
			var icon = $rootScope.base_url + '/img/icons_map/poste_cad.png';
			$rootScope.Nodes.addNoteToTree(id, tomo_node_id, $rootScope.Nodes.saving_node_id, icon, name, 5, tomo_index);
        },
        
        rename : function(id,new_name){

            var dataSend = {};
            dataSend.id = id;
            dataSend.name = new_name;
    
            link = $rootScope.base_url+"/posts/edit";
                
            $.ajax({
                    url: link,
                    type: "POST",
                    data: dataSend,
                    success:function(data){
                        for (var i = 0; i < $rootScope.Posts.posts.length; i++){
                            if($rootScope.Posts.posts[i].id === id){
                                $rootScope.Markers.removeFromMap($rootScope.Posts.posts[i].dot, $rootScope.Markers.postsMarkerCluster);
                                // $rootScope.Posts.posts[i].dot.title = new_name;

                                $rootScope.Posts.posts[i] = self.redrawPost(data.data);
                                
                                $rootScope.Markers.addToMap($rootScope.Posts.posts[i].dot, $rootScope.Markers.postsMarkerCluster);
                                $rootScope.$apply();
                            }
                        }
                    }});
    
        },
        
        viewAll : function(){
            if(self.viewAllPosts){
                angular.forEach(self.posts,function(val,index){
                    //val.dot.setMap(null);
                    $rootScope.Markers.removeFromMap(val.dot, $rootScope.Markers.postsMarkerCluster);
                    val.statusView = false;
                });
                self.viewAllPosts = 0;      
            }else{
                angular.forEach(self.posts,function(val,index){
                    //val.dot.setMap(Map.map);
                    $rootScope.Markers.addToMap(val.dot, $rootScope.Markers.postsMarkerCluster);
                    val.statusView = true;
                });               
                self.viewAllPosts = 1;   
            }
            $rootScope.Cables.viewAllCordoalhas();
        }
    }

    return self;

});



