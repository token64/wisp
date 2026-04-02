app.service('Nodes', function($rootScope,Map,Projects,dialogService,$q,Cables,$timeout,LevelsAndModes){
	var self = {
		
		nodes : [],
		treeInitialized : false,
		//No nodes is true if the api returned already, but no nodes were found
		noNodes : false,
		sharedFolderIsLoading : false,
		sharedFoldersNodes : [],
		sharedFolders : [],
		nodes_loaded_width : "0%",
		recheck_nodes : [],
		changeNodeStateQueue : [],
		isProcessingQueue : false,
			
		list : function(){
			self.isLoading = true;
            link = $rootScope.base_url+'/nodes/list_all'
            $.ajax({
                url: link,
                type: 'POST',
                success:function(response){
                	self.nodes_loaded_width = response.percentage + "%";
                	$rootScope.$apply();
					if(!self.sharedFolderIsLoading){
						self.sharedFolderIsLoading = true;
						self.list_from_shared_folders();
					}
                	
                	if (response.all_data_loaded){
                		//Everything was loaded in the first call.
                		self.nodes = response.data;
                		if (response.data.length == 0){
                    		self.noNodes = true;
                    		if ((!$rootScope.AccessPoints.isLoading) && (!$rootScope.Cables.isLoading) && (!$rootScope.Clients.isLoading)){
                    			self.constructNodesInitially();
                    		}
                    	}
                    	//var eLoaded is true if everything loaded
                    	var eLoaded = ((!$rootScope.AccessPoints.isLoading) && (!$rootScope.Cables.isLoading) && (!$rootScope.Clients.isLoading)  && (!$rootScope.Posts.isLoading)  && (!$rootScope.Buildings.isLoading));
                    	if (response.data.length > 0 && eLoaded){
                    		response.data = self.organizeNodes(response.data);
                    		self.isLoading = false;
                    		$rootScope.treeview = true;
                    		Map.initialize_treeview(response.data);
                    		self.treeInitialized = true;
                    	} else {
                    		self.isLoading = false;
                    	}
                	} else {
                		//There was too much data to get in one request, so start incremental load now.
                		self.nodes = response.data;
                		self.list_incrementally(response.offset);
                	}
                	
                },
                complete:function(){
                     $rootScope.$apply();
                }
            });
		},
		
		list_incrementally : function(offset){
			link = $rootScope.base_url+'/nodes/list_all'
			$.ajax({
                url: link,
                data: {offset : offset},
                type: 'POST',
                success:function(response){
                	self.nodes_loaded_width = response.percentage + "%";
                	$rootScope.$apply();
                	
                	if (response.all_data_loaded){
                	
                		//Everything was loaded in the first call.
                		self.nodes = self.nodes.concat(response.data);
                    	//var eLoaded is true if everything loaded
                    	var eLoaded = ((!$rootScope.AccessPoints.isLoading) && (!$rootScope.Cables.isLoading) && (!$rootScope.Clients.isLoading) && (!$rootScope.Posts.isLoading)  && (!$rootScope.Buildings.isLoading) && (!self.sharedFolderIsLoading));
                    	if (eLoaded){
                    		data = self.organizeNodes(self.nodes);

							// concatena pasta compartilhada com nodes locais
							if(sharedData = self.organize_shared_folders()){
								data.children = [...data.children,...sharedData];
							}
							
                    		self.isLoading = false;
                    		$rootScope.treeview = true;
                    		Map.initialize_treeview(data);
                    		self.treeInitialized = true;

                            // Load percentage free data initially
                            $rootScope.AccessPoints.getAllPecentageFree();
                    	} else {
                    		self.isLoading = false;
						}
						
                        // @bruno - 10/01/2021 - Desabling server cache for now
						// Send an extra request to cache all the nodes
						// cache_link = $rootScope.base_url+'/nodes/cache_all'
						// $.ajax({
						// 	url: cache_link,
						// 	type: 'POST',
						// 	success:function(response){}
						// });
                	} else {
                		//There was still too much data to get in one request, so start incremental load now.
                		self.nodes = self.nodes.concat(response.data);
                		self.list_incrementally(response.offset);
                	}
                	
                },
                complete:function(){
                     $rootScope.$apply();
                }
            })  
		},

		organize_shared_folders : function(){

			var children = [];

			//Adiciona pastas compartilhadas
			for (var i = 1; i < self.sharedFoldersNodes.length; i++){

				var sharedIdent = self.sharedFoldersNodes[i];

				var buildDataChildren = [];
				//cria a pasta do ident
				buildDataChildren = {
										children : [],
										data: {category:1,tomo_node_id: sharedIdent.tomo_node_id},
										icon: $rootScope.base_url + '/img/icons_map/folder_blue.svg',
										text: sharedIdent.ident,
										ident: sharedIdent.ident,
										sharedRoot: 1
									};
				
				var j = 0;
				
				//coloca as pastas compartilhadas dentro da pasto do ident
				while(sharedIdent[j]){

					var folder = sharedIdent[j];

					buildDataChildren.children.push(self.organizeNodes(folder,folder[folder.length - 1]));

					j++;
				}

				children.push(buildDataChildren);
				
			}

			return children;
			
		},

		list_from_shared_folders : function(){
			self.isLoading = true;
            link = $rootScope.base_url+'/shared_folders/list_from_shared_folders'
            $.ajax({
                url: link,
                type: 'POST',
                success:function(response){

					self.sharedFolders = response.sharedFolders;

                	if(response.status === 1){

						self.sharedFoldersNodes = response.all_nodes;

						$rootScope.AccessPoints.accessPointTypes =  $rootScope.AccessPoints.accessPointTypes.concat(response.AccessPointTypes);

                        response.AccessPoints.filter(a=>a).forEach(ap=>{
                            ap.category = ap.temp_category;
                        });
						
                        $rootScope.AccessPoints.organize_access_point_data(response.AccessPoints);
						$rootScope.Cables.organize_cable_data(response.Cables);
						$rootScope.Posts.organize_post_data(response.Posts);
						$rootScope.Clients.organize_client_data(response.Clients);
						$rootScope.Buildings.organize_building_data(response.Buildings);
						$rootScope.Reserves.organize_reserve_data(response.CableReserves);

						$rootScope.db_tomodat_local = response.db_tomodat_local;
					}

                	self.sharedFolderIsLoading = false;

					self.everythingLoaded("shareFolder");
                	
                },
                complete:function(){
                     $rootScope.$apply();
                },
                error:function(error){

					console.log("Erro ao carregar pastas compartilhadas",  error);
					
                    self.sharedFolderIsLoading = false;

					self.everythingLoaded("shareFolder");
					
                }
            });
		},

		/**
		 * This method is called after the AP, Cables and Clients listing - if it is called from one, and the other two
		 * are also loaded already, the nodes can be organized.
		 * */
		everythingLoaded : function(caller){
			var data = [];
			
			if ((!self.treeInitialized) && (!self.isLoading)  && (!self.sharedFolderIsLoading)){
				if ((!$rootScope.AccessPoints.isLoading) && (!$rootScope.Cables.isLoading) && (!$rootScope.Clients.isLoading) && (!$rootScope.Posts.isLoading) && (!$rootScope.Buildings.isLoading)){
						//If nodes are loaded already, the tree can be initialized
						if (self.nodes.length > 0){
							console.log("EVERYTHING LOADED!");
                            Map.showInitialPopups();
							data = self.organizeNodes(self.nodes);

							// concatena pasta compartilhada com nodes locais
							if(sharedData = self.organize_shared_folders()){
								data.children = [...data.children,...sharedData];
							}

							$rootScope.treeview = true;
							Map.initialize_treeview(data);
                            $rootScope.$apply();

                            // Load percentage free data initially
                            $rootScope.AccessPoints.getAllPecentageFree();
						//If no nodes were found, the nodes have to be constructed
						} else if (self.noNodes){
							self.constructNodesInitially();
						}
				}
			}

		},

		getTreeViewFolders : function(){

			//Load JSTree Folders
			if(!self.folders){
				self.folders = $('#jstree-sidebar-div').jstree().get_json('#', {flat:true}).filter(n=>n.data.category === 1);
			}

		},
		
		/**
		 * Reload TreeView method
		 * 
		 * Destroys current treeview, reorganizes node data, and reconstructs tree.
		 * */
		reloadTreeView : function(){
			//Destroy tree
			$('#jstree-sidebar-div').jstree().destroy();
			
			//Reorganize all data
			data = self.organizeNodes(self.nodes);
			
			//Reinitialize treeview
			Map.initialize_treeview(data);
		},

        buildNodeIndexes : function ($rootScope, nodes) {
            const indexes = {
                nodesById: {},
                apById: {},
                cableById: {},
                clientById: {},
                postById: {},
                buildingById: {}
            };

            // Index all nodes by ID
            for (let node of nodes) {
                indexes.nodesById[node.id] = node;
            }

            // Access Points (2D array: grouped by type)
            $rootScope.AccessPoints.accessPoints.forEach((group, groupIndex) => {
                group.forEach((ap, apIndex) => {
                    indexes.apById[ap.id] = [groupIndex, apIndex];
                });
            });

            // Cables (2D array)
            $rootScope.Cables.cables.forEach((group, groupIndex) => {
                group.forEach((cable, cableIndex) => {
                    indexes.cableById[cable.id] = [groupIndex, cableIndex];
                });
            });

            // Clients (flat array)
            $rootScope.Clients.clients.forEach((client, index) => {
                indexes.clientById[client.id] = [index];
            });

            // Posts (flat array)
            $rootScope.Posts.posts.forEach((post, index) => {
                indexes.postById[post.id] = [index];
            });

            // Buildings (flat array)
            $rootScope.Buildings.buildings.forEach((building, index) => {
                indexes.buildingById[building.id] = [index];
            });

            return indexes;
        },
		
		organizeNodes : function(nodes,sharedFolder){
			var org_nodes_start = new Date().getTime();
            
			self.indexes = self.buildNodeIndexes($rootScope, nodes);

			// Search for root node
			for (var i = 0; i < nodes.length; i++){
				if (!nodes[i].parent_id && !nodes[i].access_point_id && !nodes[i].cable_id && !nodes[i].client_id && !nodes[i].post_id && !nodes[i].region_id && !nodes[i].tower_id && !nodes[i].note_id){
					self.root_node = nodes[i];
					if(!sharedFolder){
						self.saving_node_id = nodes[i].id;
					}
					break;
				}
			}

            var getRootNode = new Date().getTime();
			var getRootNodeTime = getRootNode - org_nodes_start;
            console.log("ORGNODES: Get root node " + (org_nodes_time/1000).toFixed(2));
			
			var root_node_data = {};

			//Caso seja uma pasta compartilhada altera o nome e icone
			var folderName = $rootScope.Painel.company.company_name;
			var folderIcon = 'folder.svg';

			if(sharedFolder){
				folderName = sharedFolder.name;
				folderIcon = 'folder_blue.svg';
				root_node_data.sharedRoot = 1;
				root_node_data.ident = sharedFolder.ident,
				root_node_data.real_id = sharedFolder.real_id
			}

			root_node_data.text = folderName;
			root_node_data.data = {};
			root_node_data.data.category = 1; //Folder
			root_node_data.data.tomo_node_id = self.root_node.id;
			root_node_data.icon = $rootScope.base_url + '/img/icons_map/' + folderIcon;
			root_node_data.children = [];
			
			// Get child data
			for (var i = 0; i < self.root_node.child_nodes.length; i++){
				child_data = self.getChildData(self.root_node.child_nodes[i], nodes);
				if (child_data){
					root_node_data.children.push(child_data);
				}
                var getChildDataT = new Date().getTime();
                var getChildDataTime = getChildDataT - org_nodes_start;
                console.log("ORGNODES: getChildDataTime " + i + " - " + (getChildDataTime/1000).toFixed(2));
			};
			
			var org_nodes_end = new Date().getTime();
			var org_nodes_time = org_nodes_end - org_nodes_start;
	       	console.log("ORGANIZE NODES TIME (for "+nodes.length+" nodes): " + (org_nodes_time/1000).toFixed(2));
			
            self.indexes = null;

			return root_node_data;
		},
		
		getChildData : function(child_node, all_nodes){
			//Find node in the list
            let node = _.clone(self.indexes.nodesById[child_node.id]);
			
			//Check which category the node belongs to - Access Points, Cables, Clients, Posts, Notes, Regions or Towers. If none, category is 1
			/*
			 * Folders - category 1
			 * Acess Points - category 2
			 * Cables - category 3
			 * Clients - category 4
			 * Posts - category 5
			 * Notes - category 6
			 * Regions - category 7
			 * Towers - category 8
			 * Buildings - category 9
			 * */
			var node_data = {};
			node_data.data = {};
			if (node.access_point && !jQuery.isEmptyObject(node.access_point)){
				node_data.text = node.access_point.name;
				var icon = node.access_point.access_point_type.icon
				icon = icon.split('.');
				node_data.icon = $rootScope.base_url + '/img/icons_map/' + icon[0] + '_deployed.svg';
				
				node_data.data.tomo_id = node.access_point.id;
				var index = self.getApIndex(node.access_point.id);
				if (index){
					node_data.data.tomo_type_index = index[0];
					node_data.data.tomo_index = index[1];
					node_data.data.category = 2;
				} else {
					// console.log("index err:", node);
				}
				
			} else if (node.cable && !jQuery.isEmptyObject(node.cable)){
				if (node.cable.category != 4){
					node_data.text = node.cable.name;
                    let normalIcon = $rootScope.base_url + "/img/icons_map/cable.svg";
                    let errorIcon = $rootScope.base_url + "/img/icons_map/cable_with_error.svg";
					node_data.icon = $rootScope.Cables.cableHasError(node.cable.id) ? errorIcon : normalIcon;
					var index = self.getCableIndex(node.cable.id);
					node_data.data.tomo_type_index = index[0];
					node_data.data.tomo_index = index[1];
					node_data.data.tomo_id = node.cable.id;
					node_data.data.category = 3;
				}
			} else if (node.client && !jQuery.isEmptyObject(node.client)){
				node_data.text = node.client.name;
				node_data.icon = $rootScope.base_url + '/img/icons_map/cliente_tree.svg';
				var index = self.getClientIndex(node.client.id);
				if (!index){
					return false;
				}
				node_data.data.tomo_index = index[0];
				node_data.data.tomo_id = node.client.id;
				//DROP CABLE
				var tomo_client = $rootScope.Clients.getClient(node.client.id);
				if (tomo_client.drop_type_index){
					node_data.data.drop_type_index = tomo_client.drop_type_index;
					node_data.data.drop_index = tomo_client.drop_index;
				}
				node_data.data.category = 4;

				node_data.icon = self.getClientNodeIcon(tomo_client);
				
			} else if (node.post && !jQuery.isEmptyObject(node.post)){

				if(node.post.name == '' || (!node.post.name)){
					node_data.text = 'Poste';
				}else{
					node_data.text = node.post.name;
				}
				
				node_data.icon = $rootScope.base_url + '/img/icons_map/poste_cad.png';
				var index = self.getPostIndex(node.post.id);
				if (!index){
					return false;
				}
				node_data.data.tomo_index = index[0];
				node_data.data.tomo_id = node.post.id;
				node_data.data.category = 5;
				
			} else if (node.note){
				node_data.text = node.note.name;
				node_data.icon = $rootScope.base_url + '/img/icons_map/note.png';
				node_data.data.tomo_id = node.notes[0].id;
				node_data.data.category = 6;
				
			} else if (node.region){
				node_data.text = node.region.name;
				node_data.icon = $rootScope.base_url + '/img/icons_map/' + node.access_points[0].access_point_type.icon;
				node_data.data.tomo_id = node.regions[0].id;
				node_data.data.category = 7;
				
			} else if (node.tower){
				node_data.text = 'Torre';//node.towers[0].name;
				node_data.icon = $rootScope.base_url + '/img/icons_map/erb.png';
				node_data.data.tomo_id = node.towers[0].id;
				node_data.data.category = 8;
				
			} else if (node.building && !jQuery.isEmptyObject(node.building)){
				node_data.text = node.building.name;
				node_data.icon = $rootScope.base_url + '/img/icons_map/predio.svg';
				var index = self.getBuildingIndex(node.building.id);
				if (!index){
					return false;
				}
				node_data.data.tomo_index = index[0];
				node_data.data.tomo_id = node.building.id;
				node_data.data.category = 9;

			}else {
				node_data.data.category = 1;
				node_data.text = node.name;

				var icon = 'folder';

				if(node.shared){
					icon ='folder_blue';
				}else if($rootScope.Nodes.sharedFolders.find(n=>n.node_id === node.id && n.is_local)){
					icon ='folder_green';
				}
				
				node_data.icon = $rootScope.base_url + '/img/icons_map/' + icon + '.svg';
			}
			node_data.data.tomo_node_id = node.id;
			
			if(node.shared){
				node_data.shared = node.shared;
			}

			node_data.children = [];
			if (node.child_nodes){
				for (var i = 0; i < node.child_nodes.length; i++){
					child_data = self.getChildData(node.child_nodes[i], all_nodes);
					if (child_data){
						node_data.children.push(child_data);
					}
				};
			}
			//Set leaf if true - All map elements are leafs - have no child nodes
			if (node.child_nodes.length == 0){
				node_data.data.leaf = 1;
			}
			return node_data;
		},

		getClientNodeIcon : function(tomo_client){

			node_icon = $rootScope.base_url + '/img/icons_map/cliente_tree.svg';

			if(tomo_client.smartolt_integrated_flag){
				if(tomo_client.dot.lat !== '40.7491659334' && tomo_client.dot.lng !== '-73.9674780979'){
					node_icon = $rootScope.base_url + '/img/icons_map/cliente_tree_blue.svg';
				}
				if(tomo_client.splitter_id){
					node_icon = $rootScope.base_url + '/img/icons_map/cliente_tree_green.svg';
				}
			}

			return node_icon;

		},
		
		/**
		 * 
		 * */
		getApIndex : function(id){
            return self.indexes.apById[id] || false;
		},
		
		/**
		 * 
		 * */
		getCableIndex : function(id){
            return self.indexes.cableById[id] || false;
		},
		
		/**
		 * 
		 * */
		getClientIndex : function(id){
            return self.indexes.clientById[id] || false;
		},
		
		/**
		 * Get the post index in mapwisp
		 * */
		getPostIndex : function(id){
            return self.indexes.postById[id] || false;
		},
		
		/**
		 * Get the Building index in mapwisp
		 * */
		getBuildingIndex : function(id){
            return self.indexes.buildingById[id] || false;
		},
		
		/**
		 * Construct nodes initially
		 * Given that the treeview is beeing added with the software already in production, 
		 * the nodes have to be constructed, based on all the items that exist.
		 * 
		 * Take every item in cables, aps, clients, posts, etc, and create a node for each one. 
		 * node data that has to be saved: 
		 * parent_id - On constructing the thing we could save everything in a root folder, or create folders based on the projects
		 * leaf - true for every map item, false for every folder
		 * selected - false initially
		 * category - check header of function getChildData()
		 * name - Root, Project name, or element name;
		 * array containing map element data (ap, cable, post, etc.)
		 * 
		 * Folders - category 1
		 * Acess Points - category 2
		 * Cables - category 3
		 * Clients - category 4
		 * Posts - category 5
		 * Notes - category 6
		 * Regions - category 7
		 * Towers - category 8
		 * */
		constructNodesInitially : function(){
			//Avoiding a second call to this function
			if (self.constructingNodes){
				return;
			}
			self.constructingNodes = true;
			/*
			 * Take every item in cables, aps, clients, posts, etc, and create a node for each one. 
			 * node data that has to be saved: 
			 * 	 parent_id - On constructing the thing we could save everything in a root folder, or create folders based on the projects
			 * 	 leaf - true for every map item, false for every folder
			 *   selected - false initially
			 *   category - check header of function getChildData()
			 *   name - Root, Project name, or element name;
			 *   array containing map element data (ap, cable, post, etc.)
			 * 
			 * */
			
			//Create ROOT node
			var root_node = {};
			root_node.leaf = 0;
			root_node.checked = 0;
			root_node.selected = 0;
			root_node.category = 1;
			var root_node_id = self.addSync(root_node);
			
			//Project nodes added array - every element is a relation between the project id and the id of the node referring to it.
			var project_nodes_added = [];
			//Create nodes for each project existing
			angular.forEach($rootScope.Projects.projectsLoaded, function(project, project_index){
				var project_node = {};
				project_node.parent_id = root_node_id;
				project_node.leaf = 0;
				project_node.checked = 0;
				project_node.selected = 0;
				project_node.category = 1;
				project_node.name = project.name;
				var proj_id = self.addSync(project_node);
				//Relation array to store all projects added
				project_nodes_added[""+project.id] = proj_id;
			});
			
			
			//Access Points
			angular.forEach($rootScope.AccessPoints.accessPoints, function(ap_type, type_index){
				angular.forEach(ap_type, function(access_point, ap_index){
					console.log("add AP");
					var node = {};
					//Set parent id
					if (access_point.project){
						node.parent_id = project_nodes_added[""+access_point.project];
					} else {
						node.parent_id = root_node_id;
					}
					//Is a map instance, so is a leaf
					node.leaf = 1;
					node.checked = 0;
					node.selected = 0;
					node.category = 2;
					node.name = access_point.name;
					node.access_point_id = access_point.id;
					self.add(node);
				});
			});
			
			//Cable
			angular.forEach($rootScope.Cables.cables, function(cables, type_index){
				angular.forEach(cables, function(cable, cable_index){
					console.log("add Cable");
					var node = {};
					//Set parent id
					if (cable.project){
						node.parent_id = project_nodes_added[""+cable.project];
					} else {
						node.parent_id = root_node_id;
					}
					//Is a map instance, so is a leaf
					node.leaf = 1;
					node.checked = 0;
					node.selected = 0;
					node.category = 3;
					node.name = cable.name;
					node.cable_id = cable.id;
					self.add(node);
				});
			});
			
			//Clients
			angular.forEach($rootScope.Clients.clients, function(client, client_index){
				console.log("add Client");
				var node = {};
				//Set parent id
				if (client.project){
					node.parent_id = project_nodes_added[""+client.project];
				} else {
					node.parent_id = root_node_id;
				}
				//Is a map instance, so is a leaf
				node.leaf = 1;
				node.checked = 0;
				node.selected = 0;
				node.category = 4;
				node.name = client.name;
				node.client_id = client.id;
				self.add(node);
			});
			
			//Posts
			angular.forEach($rootScope.Posts.posts, function(post, post_index){
				console.log("add Post");
				var node = {};
				//Set parent id
				if (post.project){
					node.parent_id = project_nodes_added[""+post.project];
				} else {
					node.parent_id = root_node_id;
				}
				//Is a map instance, so is a leaf
				node.leaf = 1;
				node.checked = 0;
				node.selected = 0;
				node.category = 5;
				node.name = post.name;
				node.post_id = post.id;
				self.add(node);
			});
			
			//Notes
			
			//Regions
			
			//Towers
			self.list();
		},
		
		addSync : function(data){
			link = $rootScope.base_url+'/nodes/add'
			var id;
            $.ajax({
                url: link,
                data: data,
                type: 'POST',
                async: false,
                success:function(data){
                	if (data.status == 1){
                		id = data.id;
                        self.nodes.push(data);
                	} else {
                		console.log("Error nodesService.js");
                	}
                }
            }) 
			return id;
		},
		
		add : function(data){
			link = $rootScope.base_url+'/nodes/add'
            $.ajax({
                url: link,
                data: data,
                type: 'POST',
                success:function(data){
                	self.nodes.push(data);
                }
            })  
		},
		
		/**
		 * Expects data containing id and all already
		 * */
		edit : function(data){
			link = $rootScope.base_url+'/nodes/edit'
            $.ajax({
                url: link,
                data: data,
                type: 'POST',
                success:function(data){
                	//Do something here? Not for now, because the tree is already updated.
                }
            }) 
		},
		
		deleteNode : function(data){
			link = $rootScope.base_url+'/nodes/delete'
            $.ajax({
                url: link,
                data: data,
                type: 'POST',
                success:function(data){
                	//Do something here? Not for now, because the tree is already updated.
                }
            }) 
		},
		
		deleteNodeFromTree : function(tomo_node_id){
			//Delete the node data from the local nodes array first:
			for(var i = 0; i < self.nodes.length; i++){
				if(self.nodes[i].id == tomo_node_id){
					self.nodes.splice(i, 1);
					break;
				}
			}
			
			//Delete from the tree
			var node_list = $('#jstree-sidebar-div').jstree().get_json($('#jstree-sidebar-div'), {
			      flat: true
		    });
			var i;
			for(i = 0; i < node_list.length; i++){
				if (node_list[i].data.tomo_node_id == tomo_node_id){
					$('#jstree-sidebar-div').jstree().delete_node(node_list[i]);
					break;
				}
			}
			
		},
		
		addNoteToTree : function(tomo_id, tomo_node_id, tomo_parent_id, icon_path, name, category, tomo_index, tomo_type_index){
			//Get the parent node
			var node_list = $('#jstree-sidebar-div').jstree().get_json($('#jstree-sidebar-div'), {
			      flat: true
		    });
			var i;
			for(i = 0; i < node_list.length; i++){
				if (node_list[i].data.tomo_node_id == tomo_parent_id){
					var parent = node_list[i];
					break;
				}
			}
			//Create node data
			if (tomo_type_index){
				var new_node = {text:name, icon:icon_path, data:{'leaf' : 1, 'category' : category, 'tomo_id': tomo_id, 'tomo_node_id' : tomo_node_id, 'tomo_index' : tomo_index, 'tomo_type_index' : tomo_type_index}};
			} else {
				var new_node = {text:name, icon:icon_path, data:{'leaf' : 1, 'category' : category, 'tomo_id': tomo_id, 'tomo_node_id' : tomo_node_id, 'tomo_index' : tomo_index}};
			}
    	   	var node_added = $('#jstree-sidebar-div').jstree('create_node', parent, new_node, 'first');
    	   	new_node = $('#jstree-sidebar-div').jstree().get_node(node_added);
    	   	//$("#jstree-sidebar-div").jstree().select_node(new_node);
    	   	$("#jstree-sidebar-div").jstree().check_node(new_node);
    	   	//Mark the parent again.
			self.setStrongWeight();
		},
		
		/**
		 * Desect all method
		 * deselects all nodes, but triggering the event 'deselect_node', in order to hide the map elements.
		 * 
		 * */
		deselect_all : function(){
			checked = $("#jstree-sidebar-div").jstree("get_checked",null,true);
			angular.forEach(checked, function(id, index){
				var node = $("#jstree-sidebar-div").jstree().get_node(id);
				$("#jstree-sidebar-div").jstree().uncheck_node(node);
			});
		},
		
		/**
		 * Sets the node received as the folder to save new elements from the map.
		 * expects the node received to be a category 1 node.
		 * */
		setAsSavingFolder : function(node){
			//get the old saving node id
			var old = self.saving_node_jstree_id;
			//Set the new saving node id
			self.saving_node_id = node.data.tomo_node_id;
			self.saving_node_jstree_id = node.id;
			
			//Unmark the old saving node
			if (old){
				var old_node = $("#jstree-sidebar-div").jstree().get_node(old);
				self.unsetStrongWeight(old_node);
			}
			//Mark the new saving folder
			self.setStrongWeight();
		},
		
		setStrongWeight : function(){
			if (self.saving_node_jstree_id){
				var node = $("#jstree-sidebar-div").jstree().get_node(self.saving_node_jstree_id);
				var dom_id = '#' + node.a_attr.id;
				$(dom_id).addClass('jstree-bold');
			}
		},
		
		unsetStrongWeight : function(node){
			var dom_id = '#' + node.a_attr.id;
			$(dom_id).removeClass('jstree-bold');
		},
		
		changeNodeName : function(category, id, new_name){
			selected = $("#jstree-sidebar-div").jstree("get_checked",null,true);
			angular.forEach(selected, function(node_id, index){
				var node = $("#jstree-sidebar-div").jstree().get_node(node_id);

				if(node){
				
					if (node.data.category == category){
						if (node.data.tomo_id == id){
							$('#jstree-sidebar-div').jstree().rename_node(node, new_name);
						}
					}
				}
			});
		},
		
		changeNodeIcon : function(category, data, icon){
			selected = $("#jstree-sidebar-div").jstree("get_checked",null,true);
			angular.forEach(selected, function(node_id, index){
				var node = $("#jstree-sidebar-div").jstree().get_node(node_id);

				if(node){
				
					if (node.data.category == category){

						if (node.data.tomo_id == data.id){
							if(category === 4){
								icon = self.getClientNodeIcon(data);
							}
							$('#jstree-sidebar-div').jstree().set_icon(node, icon);
						}
					}
				}
			});
		},

		processChangeNodeStateQueue : function () {
			if (!self.processedNodeStates) self.processedNodeStates = [];

			// Fila acabou: enviar tudo agora
			if (self.changeNodeStateQueue.length === 0) {
				self.isProcessingQueue = false;

				if (self.processedNodeStates.length === 1) {
					const node = self.processedNodeStates[0];
					const link = $rootScope.base_url + '/nodes/set_selected';
					$.ajax({
						url: link,
						type: 'POST',
						data: node,
						success: function () {
							$rootScope.$apply();
						},
						error: function (err) {
							console.warn("Erro ao enviar único node:", err);
						},
						complete: function () {
							self.processedNodeStates = [];
						}
					});
				}
				else if (self.processedNodeStates.length > 1) {
					const link = $rootScope.base_url + '/nodes/set_selected_batch';
					$.ajax({
						url: link,
						type: 'POST',
						data: {
							nodes: JSON.stringify(self.processedNodeStates)
						},
						success: function () {
							$rootScope.$apply();
							
						},
						error: function (err) {
							console.warn("Erro no envio em lote:", err);
						},
						complete: function () {
							self.processedNodeStates = [];
						}
					});
				}

				return;
			}

			self.isProcessingQueue = true;

			const node = self.changeNodeStateQueue.shift();

			if (node && node.data && node.data.tomo_node_id) {
				self.processedNodeStates.push({
					id: node.data.tomo_node_id,
					selected: node.state.checked
				});
			}

			setTimeout(self.processChangeNodeStateQueue, 0);
		},

		changeNodeState : function(node){
			if (!node || !node.data || !node.data.tomo_node_id) return;

			if (!self.changeNodeStateQueue) self.changeNodeStateQueue = [];
			if (!self.processedNodeStates) self.processedNodeStates = [];

			self.changeNodeStateQueue.push(node);

			if (!self.isProcessingQueue) {
				self.processChangeNodeStateQueue();
			}

		},
		
		toggle : function(event, type){
			element = event.currentTarget;
			var activate = false;
			if ($(element).hasClass("treeview-toggle-button") && !$(element).hasClass("treeview-toggle-button-active")){
				$(element).removeClass("treeview-toggle-button");
				$(element).addClass("treeview-toggle-button-active");
				activate = true;
			} else {
				$(element).removeClass("treeview-toggle-button-active");
				$(element).addClass("treeview-toggle-button");
			}
			
			if (activate){
				self.showNodes(type);
			} else {
				self.hideNodes(type);
			}
		},

		toggleCables : function(cableType){

            var addJson = {id:cableType.id};
            
            // Caso encontre o typo no json, deleta para exibir
            if(!jQuery.isEmptyObject($rootScope.user_data.user_setting.show_cable_types_json)){
                var find = $rootScope.user_data.user_setting.show_cable_types_json.findIndex(t=>t.id === cableType.id);
                if(find >= 0){
                    $rootScope.user_data.user_setting.show_cable_types_json.splice(find,1);
                }else{
                	$rootScope.user_data.user_setting.show_cable_types_json.push(addJson);
                }
            }else{
            	$rootScope.user_data.user_setting.show_cable_types_json.push(addJson);
            }

            nodes = $('#jstree-sidebar-div').jstree().get_json('#', {flat:true}).filter(n => n.data.category == 3);
            
            angular.forEach(nodes, function(node, index_node){

                if(!$rootScope.Cables.cables[node.data.tomo_type_index]){
                    return; //evitar bug se array vazio
                }
                var cable = $rootScope.Cables.cables[node.data.tomo_type_index][node.data.tomo_index];
              
                if (cableType.id === cable.cable_type_id){
                    if (self.showCableType(cableType)){

                        $('#jstree-sidebar-div').jstree().uncheck_node(node); //forçar exibir no mapa

                        $('#jstree-sidebar-div').jstree().show_node(node, true);

                        $("#jstree-sidebar-div").jstree().check_node(node);

                    }else{

                        $('#jstree-sidebar-div').jstree().hide_node(node, true);
                        if (node.state.checked){
                            $("#jstree-sidebar-div").jstree().uncheck_node(node);
                            // Put this node in an array, to recheck it once its asked for.
                            self.recheck_nodes.push(node);
                        }

                    }
                }
            });

            link = $rootScope.base_url+'/Profiles/edit'
			$.post(link, 
				{
					user_setting:
					{
						show_cable_types_json:JSON.stringify($rootScope.user_data.user_setting.show_cable_types_json),
					}
				},
				function(data) {			
					$rootScope.$apply();					
				}
			);

            $('#jstree-sidebar-div').jstree().redraw(true);

        },

        showCableType : function(cableType){

            if(!cableType){
            	return true;
            }

            if(!Array.isArray($rootScope.user_data.user_setting.show_cable_types_json)){
            	$rootScope.user_data.user_setting.show_cable_types_json = JSON.parse($rootScope.user_data.user_setting.show_cable_types_json);
            }

            var json = $rootScope.user_data.user_setting.show_cable_types_json ? $rootScope.user_data.user_setting.show_cable_types_json : [];

			var show = true;

            //se o id do cabo estiver no json é pra esconder o cabo
			if(!jQuery.isEmptyObject(json)){
				var find = json.find(t=>t.id === cableType.id);
				show = find ? false : true;
			}

        	return show;
        },

		showPostGroup : function(post){

            if(!post){
            	return true;
            }

            if(!Array.isArray($rootScope.user_data.user_setting.show_post_groups_json)){
            	$rootScope.user_data.user_setting.show_post_groups_json = JSON.parse($rootScope.user_data.user_setting.show_post_groups_json);
            }

            var json = $rootScope.user_data.user_setting.show_post_groups_json ? $rootScope.user_data.user_setting.show_post_groups_json : [];

			var show = true;

			if(!jQuery.isEmptyObject(json)){
				var find = json.find(t=>t.group_identifier === post.group_identifier);
				show = find ? false : true;
			}

        	return show;
        },

		togglePosts : function(postData){

			var addJson = {group_identifier:postData.group_identifier};
            
            // Caso encontre o typo no json, deleta para exibir
            if(!jQuery.isEmptyObject($rootScope.user_data.user_setting.show_post_groups_json)){
                var find = $rootScope.user_data.user_setting.show_post_groups_json.findIndex(t=>t.group_identifier === postData.group_identifier);
                if(find >= 0){
                    $rootScope.user_data.user_setting.show_post_groups_json.splice(find,1);
                }else{
                	$rootScope.user_data.user_setting.show_post_groups_json.push(addJson);
                }
            }else{
            	$rootScope.user_data.user_setting.show_post_groups_json.push(addJson);
            }

            nodes = $('#jstree-sidebar-div').jstree().get_json('#', {flat:true}).filter(n => n.data.category == 5);
            
            angular.forEach(nodes, function(node, index_node){

                if(!$rootScope.Posts.posts[node.data.tomo_index]){
                    return; //evitar bug se array vazio
                }
                var post = $rootScope.Posts.posts[node.data.tomo_index];
              
                if (post.group_identifier === postData.group_identifier){
                    if (self.showPostGroup(post)){

                        $('#jstree-sidebar-div').jstree().uncheck_node(node); //forçar exibir no mapa

                        $('#jstree-sidebar-div').jstree().show_node(node, true);

                        $("#jstree-sidebar-div").jstree().check_node(node);

                    }else{

                        $('#jstree-sidebar-div').jstree().hide_node(node, true);
                        if (node.state.checked){
                            $("#jstree-sidebar-div").jstree().uncheck_node(node);
                            // Put this node in an array, to recheck it once its asked for.
                            self.recheck_nodes.push(node);
                        }

                    }
                }
            });

            link = $rootScope.base_url+'/Profiles/edit'
			$.post(link, 
				{
					user_setting:
					{
						show_post_groups_json:JSON.stringify($rootScope.user_data.user_setting.show_post_groups_json),
					}
				},
				function(data) {			
					$rootScope.$apply();					
				}
			);

            $('#jstree-sidebar-div').jstree().redraw(true);

        },

		isEmptyJsonPostGroups : function(){
        	if(!$rootScope.user_data){
        		return true;
			}
			
        	if($rootScope.user_data.user_setting.show_post_groups_json === ""
        		|| $rootScope.user_data.user_setting.show_post_groups_json === "[]"){
                	$rootScope.user_data.user_setting.show_post_groups_json = [];
            }
        	if(!jQuery.isEmptyObject($rootScope.user_data.user_setting.show_post_groups_json)){
        		return false;
			}
            return true;
        },

        isEmptyJsonCableTypes : function(){
        	if(!$rootScope.user_data){
        		return true;
			}
			
        	if($rootScope.user_data.user_setting.show_cable_types_json === ""
        		|| $rootScope.user_data.user_setting.show_cable_types_json === "[]"){
                	$rootScope.user_data.user_setting.show_cable_types_json = [];
            }
        	if(!jQuery.isEmptyObject($rootScope.user_data.user_setting.show_cable_types_json)){
        		return false;
			}
            return true;
        },
		
		hideNodes : function(type){

			if (type == 1){
				//Cables
				category = 3;
				tomo_type_index = 1;
				$rootScope.user_data.user_setting.show_cables = false;
			} else if (type == 2){
				//Caixas de Emenda
				category = 2;
				tomo_type_index = 4;
				$rootScope.user_data.user_setting.show_cx_em = false;
			} else if (type == 3){
				//Caixas de atendimento
				category = 2;
				tomo_type_index = 5;
				$rootScope.user_data.user_setting.show_cx_at = false;
			} else if (type == 4){
				//Racks
				category = 2;
				tomo_type_index = 2;
				$rootScope.user_data.user_setting.show_racks = false;
			} else if (type == 5){
				//Clients
				category = 4;
				$rootScope.user_data.user_setting.show_clients = false;
			} else if (type == 6){
				//PACs
				category = 2;
				tomo_type_index = 3;
				$rootScope.user_data.user_setting.show_pacs = false;
			} else if (type == 7){
				//Postes
				category = 5;
				$rootScope.user_data.user_setting.show_posts = false;
			} else if (type == 8){
				//Predios
				category = 9;
				$rootScope.user_data.user_setting.show_buildings = false;
			} else if (type == 9){ 
				//Cordoalhas
				category = 3;
				tomo_type_index = 3;

				if (!self.isLoading){
					angular.forEach($rootScope.Cables.cables[category],function(el, index){
						el.polyline.setMap(null); 
						el.statusView = 0; 
					});
				}

			} else if (type == 10){
				//Cameras
				category = 2;
				tomo_type_index = 6;
				$rootScope.user_data.user_setting.show_cameras = false;
			} else {
				return;
			}

			nodes = $('#jstree-sidebar-div').jstree().get_json('#', {flat:true}).filter(n => n.data.category == category);
			
			angular.forEach(nodes, function(node, index_node){
				if (node.data.category == category){
					//if (category == 2){
					if (category == 2 || category == 3){
						if (node.data.tomo_type_index != tomo_type_index){
							return;
						}
					}
					$('#jstree-sidebar-div').jstree().hide_node(node, true);
					if (node.state.checked){
						$("#jstree-sidebar-div").jstree().uncheck_node(node);
						// Put this node in an array, to recheck it once its asked for.
						self.recheck_nodes.push(node);
					}
				}
			});

			link = $rootScope.base_url+'/Profiles/edit'
			$.post(link, 
				{
					user_setting:
					{
						show_cables:$rootScope.user_data.user_setting.show_cables,
						show_cx_em:$rootScope.user_data.user_setting.show_cx_em,
						show_cx_at:$rootScope.user_data.user_setting.show_cx_at,
						show_racks:$rootScope.user_data.user_setting.show_racks,
						show_pacs:$rootScope.user_data.user_setting.show_pacs,
						show_cameras:$rootScope.user_data.user_setting.show_cameras,
						show_clients:$rootScope.user_data.user_setting.show_clients,
						show_posts:$rootScope.user_data.user_setting.show_posts,
						show_buildings:$rootScope.user_data.user_setting.show_buildings,
					}
				},
				function(data) {			
					$rootScope.$apply();					
				}
			);

			$('#jstree-sidebar-div').jstree().redraw(true);

		},

		hideUndeployedAps : function(){

			nodes = $('#jstree-sidebar-div').jstree().get_json('#', {flat:true}).filter(n => n.data.category == 2 && n.data.tomo_type_index === 5);
			
			angular.forEach(nodes, function(node, index_node){
					
				var ap = $rootScope.AccessPoints.accessPoints[5].find(a=>a && a.id === node.data.tomo_id);

				if(ap){

					if(!ap.deploy_information || (ap.deploy_information && !ap.deploy_information.deployed)){
										
						$('#jstree-sidebar-div').jstree().hide_node(node,true);
						
						if (node.state.checked){
							$("#jstree-sidebar-div").jstree().uncheck_node(node);
							// Put this node in an array, to recheck it once its asked for.
							self.recheck_nodes.push(node);
						}
					}
				}
				
			});

			$('#jstree-sidebar-div').jstree().redraw(true);

		},
		
		viewDeployeds : function(type){

			if(type === 1){
				$rootScope.user_data.user_setting.show_undeployeds = $rootScope.user_data.user_setting.show_undeployeds ? false : true;
			}else if(type === 2){
				$rootScope.user_data.user_setting.show_deployeds = $rootScope.user_data.user_setting.show_deployeds ? false : true;
			}

			nodes = $('#jstree-sidebar-div').jstree().get_json('#', {flat:true});
			
			angular.forEach(nodes, function(node, index_node){

                if (node.data.category == 2){
					var item = $rootScope.AccessPoints.accessPoints[node.data.tomo_type_index][node.data.tomo_index];

					//Cables
				}else if (node.data.category == 3){
					if(!$rootScope.Cables.cables[node.data.tomo_type_index]){
						return; //evitar bug se array vazio
					}
					var item = $rootScope.Cables.cables[node.data.tomo_type_index][node.data.tomo_index];
						
				}else if (node.data.category == 4){
					var item = $rootScope.Clients.clients[node.data.tomo_index];
				}else if (node.data.category == 5){
					var item = $rootScope.Posts.posts[node.data.tomo_index];
				}else if (node.data.category == 9){
					var item = $rootScope.Buildings.buildings[node.data.tomo_index];
				}else{
					return;
				}
				
				if (self.onOffDeployed(item)){
					//removido pq qd clicava pra não mostrar implantados não estava mostrando nada
					// $('#jstree-sidebar-div').jstree().uncheck_node(node); //forçar exibir no mapa

					$('#jstree-sidebar-div').jstree().show_node(node, true);

					$("#jstree-sidebar-div").jstree().check_node(node);
				}else{

					$('#jstree-sidebar-div').jstree().hide_node(node, true);
					if (node.state.checked){
						$("#jstree-sidebar-div").jstree().uncheck_node(node);
						// Put this node in an array, to recheck it once its asked for.
						self.recheck_nodes.push(node);
					}

				}
			});

			// $('#jstree-sidebar-div').jstree().redraw(true);
			
			//caso seja o usuário do suporte não altera perfil
			if($rootScope.Users.current_user.id === 10000) return;

			link = $rootScope.base_url+'/Profiles/edit'
			$.post(link, 
				{
					user_setting:
					{
						show_deployeds:$rootScope.user_data.user_setting.show_deployeds,
						show_undeployeds:$rootScope.user_data.user_setting.show_undeployeds,
					}
				},
				function(data) {			
					$rootScope.$apply();					
				}
			);
			
		},

		onOffDeployed : function(item){
		   if(item.deploy_information){
			   if(item.deploy_information.deployed && $rootScope.user_data.user_setting.show_deployeds){
					return true;
			   }else if (!item.deploy_information.deployed && $rootScope.user_data.user_setting.show_undeployeds){
					return true;
			   }
		   }else if($rootScope.user_data.user_setting.show_undeployeds){
				return true;
		   }
		   return false;
	   },

		showNodes : function(type){

			if (type == 1){
				//Cables
				category = 3;
				tomo_type_index = 1; 
				$rootScope.user_data.user_setting.show_cables = true;
			} else if (type == 2){
				//Caixas de Emenda
				category = 2;
				tomo_type_index = 4;
				$rootScope.user_data.user_setting.show_cx_em = true;
			} else if (type == 3){
				//Caixas de atendimento
				category = 2;
				tomo_type_index = 5;
				$rootScope.user_data.user_setting.show_cx_at = true;
			} else if (type == 4){
				//Racks
				category = 2;
				tomo_type_index = 2;
				$rootScope.user_data.user_setting.show_racks = true;
			} else if (type == 5){
				//Clients
				category = 4;
				$rootScope.user_data.user_setting.show_clients = true;
			} else if (type == 6){
				//PACs
				category = 2;
				tomo_type_index = 3;
				$rootScope.user_data.user_setting.show_pacs = true;
			} else if (type == 7){
				//Postes
				category = 5;
				$rootScope.user_data.user_setting.show_posts = true;
			} else if (type == 8){
				//Predios
				category = 9;
				$rootScope.user_data.user_setting.show_buildings = true;
			} else if (type == 10){
				//Cameras
				category = 2;
				tomo_type_index = 6;
				$rootScope.user_data.user_setting.show_cameras = true;
			} else {
				return;
			}

			nodes = $('#jstree-sidebar-div').jstree().get_json('#', {flat:true}).filter(n => n.data.category == category);
			
			angular.forEach(nodes, function(node, index_node){
				if (node.data.category == category){					
					//if (category == 2){
					if (category == 2 || category == 3){
						if (node.data.tomo_type_index != tomo_type_index){
							return;
						}
					}
					
					$('#jstree-sidebar-div').jstree().uncheck_node(node); //forçar exibir no mapa

					$('#jstree-sidebar-div').jstree().show_node(node, true);
					// If this node is in the recheck array, 
					// recheck it, and remove from array
					//idx = self.recheckNode(node);
					//if (idx != -1){
						$("#jstree-sidebar-div").jstree().check_node(node);
						//self.recheck_nodes.splice(idx, 1);
					//}
				}
			});

			link = $rootScope.base_url+'/Profiles/edit'
			$.post(link, 
				{
					user_setting:
					{
						show_cables:$rootScope.user_data.user_setting.show_cables,
						show_cx_em:$rootScope.user_data.user_setting.show_cx_em,
						show_cx_at:$rootScope.user_data.user_setting.show_cx_at,
						show_racks:$rootScope.user_data.user_setting.show_racks,
						show_pacs:$rootScope.user_data.user_setting.show_pacs,
						show_cameras:$rootScope.user_data.user_setting.show_cameras,
						show_clients:$rootScope.user_data.user_setting.show_clients,
						show_posts:$rootScope.user_data.user_setting.show_posts,
						show_buildings:$rootScope.user_data.user_setting.show_buildings,
					}
				},
				function(data) {			
					$rootScope.$apply();					
				}
			);

			$('#jstree-sidebar-div').jstree().redraw(true);
			
		},
		
		/**
		 * Recheck Node method
		 * Returns the index of the node that has to be rechecked, or
		 * -1 if its not there.
		 * */
		recheckNode : function(node){
			for(var i = 0; i < self.recheck_nodes.length; i++){
				if (self.recheck_nodes[i].id == node.id){
					return i;
				}
			}
			return -1;
		},
		
		/**
		 * delete content method
		 * Called when user clicks on "Delete folder with contents" on the treeview.
		 * Opens modal to check if user is sure about it.
		 * */
		deleteContent : function(node){
			//Send event to analytics
			if ($rootScope.run_analytics) {
				ga("send", {
					hitType: "event",
					eventCategory: "Delete Folder Contents",
					eventAction: "Delete Folder Contents Click",
					eventLabel: "Click on Delete Folder Contents"
				});
			}

			//If it's the root node, don't allow it
			if (node.parents.length <= 1){
				throw "ERROR: Root node can't be deleted";
				return;
			}
			//If it's not a folder, don't allow it
			if (node.data.category != 1){
				throw "ERROR: Leaf node can't be deleted";
				return;
			}
			//Set node data to scope
			self.nodeToBeDeleted = node;
			
			//Open deletion modal
			var options = {
					autoOpen: false,
					modal: false,
					title: $rootScope.Users.translateText('Deletar pasta com conteúdo'),
					width: 352,
					height:'auto',
					resizable:false,
					dialogClass: "noclose", 
					dialogClass: "noclose no-scroll",
					create: function (event, ui) {
						$(event.target).parent().css('position', 'fixed');
					},
					close:function(){
						//
					}
				};
				model = [];
				dialogService.open('deleteFolderContents','deleteFolderContents', model, options).then();
		},
		
		/**
		 * Delete Content Pre Confirm Method
		 * 
		 * After first confirmation on the modal, show all data that will be deleted in self.nodeToBeDeleted
		 * */
		deleteContentPreConfirm : function(){
			//Find all elements in this folder
			self.delete_elements = [];
			self.delete_elements['folders'] = [];
			self.delete_elements['access_points'] = [];
			self.delete_elements['cables'] = [];
			self.delete_elements['clients'] = [];
			self.delete_elements['posts'] = [];
			angular.forEach(self.nodeToBeDeleted.children_d, function(child_id, idx){
				child_node = $('#jstree-sidebar-div').jstree().get_node(child_id);
				switch(child_node.data.category) {
				case 1:
					self.delete_elements['folders'].push(child_node);
					break;
				case 2:
					self.delete_elements['access_points'].push(child_node);
					break;
				case 3:
					self.delete_elements['cables'].push(child_node);
					break;
				case 4:
					self.delete_elements['clients'].push(child_node);
					break;
				case 5:
					self.delete_elements['posts'].push(child_node);
					break;
				default:
					console.log("what type of node is this?");
					console.log(child_node);
					break;
				}
			});
			
			//Set var to show what will be deleted in the modal
			self.delete_first_confirm = true;
		},
		
		/**
		 * Calls backend method to delete all content of the node
		 * */
		deleteContentConfirm : function(){
			//Send event to analytics
			if ($rootScope.run_analytics) {
				ga("send", {
					hitType: "event",
					eventCategory: "Delete Folder Contents",
					eventAction: "Delete Confirm",
					eventLabel: "Confirm Deleting Folder Contents"
				});
			}

			self.isLoading = true;
			// Call backend function
			cache_link = $rootScope.base_url+"/nodes/delete_with_content";
			$.ajax({
				url: cache_link,
				data: {id: self.nodeToBeDeleted.data.tomo_node_id},
				type: "POST",
				success:function(response){
					self.isLoading = false;
					if (response.status === 1){
						//Delete node in the FrontEnd
						$("#jstree-sidebar-div").jstree().delete_node(self.nodeToBeDeleted);
						setTimeout(function(){
							// Reload page to force all markers and lines to be thrown away
							// TODO this is not the optimal solution for the user. Reloading
							// might mean long wait times depending on the size of the database
							location.reload(true);
						},1500);
					}
					$rootScope.set_errors_modal(response,"deleteFolderContents");
					$rootScope.$apply();
				},
				error:function(response){
					self.isLoading = false;
					console.log("Uncaught error on content delet: ", response);
				}
			});
			
		},

		/**
		 * Delete Content Confirm Method
		 * 
		 * After second confirmation on the modal, delete all contents of the folder in self.nodeToBeDeleted
		 * */
		deleteContentConfirmOld : function(){
			self.isLoading = true;
			var non_deletable_folders = [];
			//Set modal info
			self.folder_deleting_ongoing = true;
			
			//Delete Access Points
			angular.forEach(self.delete_elements['access_points'], function(access_point_node, index){
				self.folder_deleting_aps = true;
				//Delete all connections in the AP first
				$rootScope.AccessPoints.deleteAPConnections(access_point_node.data.tomo_id);
				$rootScope.AccessPoints.deleteConfirm(access_point_node.data.tomo_id, access_point_node.data.tomo_type_index, true);
				console.log("deleted access_point");
			});
			self.folder_deleting_aps = false;

			//Delete Clients
			angular.forEach(self.delete_elements['clients'], function(client_node, index){
				self.folder_deleting_clients = true;
				$rootScope.Clients.deleteConfirm(client_node.data.tomo_id, true);
				console.log("deleted client");
			});
			self.folder_deleting_clients = false;

			//Delete Posts
			angular.forEach(self.delete_elements['posts'], function(post_node, index){
				self.folder_deleting_posts = true;
				$rootScope.Posts.deleteConfirm(post_node.data.tomo_id, true);
				console.log("deleted post");
			});
			self.folder_deleting_posts = false;
			
			//Delete Cables
			angular.forEach(self.delete_elements['cables'], function(cable_node, index){
				self.folder_deleting_cables = true;
				//Delete cable
				if (!$rootScope.Cables.deleteConfirm(cable_node.data.tomo_id, cable_node.data.tomo_type_index, true)){
					// As this cable wasn't deleted, mark all parent folders as non-deletable folders
					non_deletable_folders = non_deletable_folders.concat(cable_node.parents);
				} else {
					console.log("deleted cable");
				}
			});
			self.folder_deleting_cables = false;

			//Delete Folders
			angular.forEach(self.delete_elements['folders'], function(folder_node, index){
				self.folder_deleting_folders = true;
				if (!(non_deletable_folders.indexOf(folder_node.id) > -1)){
					$('#jstree-sidebar-div').jstree().delete_node(folder_node);
					console.log("deleted folder");
				}
			});
			self.folder_deleting_folders = false;
			
			//reload Treeview
			console.log("will reload treeview");
			self.reloadTreeView();
			
			self.isLoading = false;
		},
		
		/**
		 * Delete content cancel method
		 * 
		 * Cancels the operation of deleting the folder and its contents
		 * */
		deleteContentCancel : function(){
			//Clean up
			self.delete_first_confirm = false;
			self.delete_elements = null;
			self.nodeToBeDeleted = null;
			//Close modal
			dialogService.close('deleteFolderContents');
		},
		
		/**
		 * Show Content on Map method
		 * 
		 * */
		/*
		 * Folders - category 1
		 * Acess Points - category 2
		 * Cables - category 3
		 * Clients - category 4
		 * Posts - category 5
		 * Notes - category 6
		 * Regions - category 7
		 * Towers - category 8
		 * Buildings - category 9
		 * */
		showContentOnMap : function(node,noBounds){
			//Send event to analytics
			if ($rootScope.run_analytics) {
				ga("send", {
					hitType: "event",
					eventCategory: "TreeView Actions",
					eventAction: "Show Content on Map",
					eventLabel: "Show Content on Map"
				});
			}

			// Criar bounds
			var bounds = new google.maps.LatLngBounds();
			// Passar por todos os nodos na pasta, e extender bounds com bounds.extend(myLatLng);
			angular.forEach(node.children_d, function(child_id, idx){
				child_node = $('#jstree-sidebar-div').jstree().get_node(child_id);
				switch(child_node.data.category) {
				case 2:
					var access_point = $rootScope.AccessPoints.accessPoints[child_node.data.tomo_type_index][child_node.data.tomo_index];
					if (!access_point.dot){
						break;
					}
					var latlng = new google.maps.LatLng(access_point.dot.position.lat(), access_point.dot.position.lng());
					bounds.extend(latlng);
					break;
				case 3:
					var cable = $rootScope.Cables.cables[child_node.data.tomo_type_index][child_node.data.tomo_index];
					angular.forEach(cable.dots, function(dot, idx){
						bounds.extend(new google.maps.LatLng(dot.position.lat(), dot.position.lng()));
					});
					break;
				case 4:
					var client = $rootScope.Clients.clients[child_node.data.tomo_index];
					if (!client.dot){
						break;
					}
					var latlng = new google.maps.LatLng(client.dot.lat, client.dot.lng);
					bounds.extend(latlng);
					break;
				case 5:
					var post = $rootScope.Posts.posts[child_node.data.tomo_index];
					var latlng = new google.maps.LatLng(post.dot.position.lat(), post.dot.position.lng());
					bounds.extend(latlng);
					break;
				case 9:
					var building = $rootScope.Buildings.buildings[child_node.data.tomo_index];
					var latlng = new google.maps.LatLng(building.dot.lat, building.dot.lng);
					bounds.extend(latlng);
					break;
				default:
					break;
				}
			});
			
			if(!noBounds){
				// Fit bounds
				$rootScope.map.map.fitBounds(bounds);
			}
			
			// Check the node
			$('#jstree-sidebar-div').jstree('check_node', node);
		},

		/**
		 * Verifica se o toggle está marcado para exibir o item na treeview
		 * */
		verifyToggle : function(){

			if(!$rootScope.user_data.user_setting.show_cables){
				self.hideNodes(1);
			}

			if(!$rootScope.user_data.user_setting.show_cx_em){
				self.hideNodes(2);
			}

			if(!$rootScope.user_data.user_setting.show_cx_at){
				self.hideNodes(3);
			}

			if($rootScope.Painel.show_only_deployeds_aps && 
				$rootScope.Painel.show_only_deployeds_aps.value &&
                LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_COMERCIAL])){
                self.hideUndeployedAps();
            }

			if(!$rootScope.user_data.user_setting.show_racks){
				self.hideNodes(4);
			}

			if(!$rootScope.user_data.user_setting.show_clients){
				self.hideNodes(5);
			}

			if(!$rootScope.user_data.user_setting.show_pacs){
				self.hideNodes(6);
			}

			if(!$rootScope.user_data.user_setting.show_posts){
				self.hideNodes(7);
			}

			if(!$rootScope.user_data.user_setting.show_buildings){
				self.hideNodes(8);
			}

		},

		/**
		 * share folder method
		 * */
		 shareFolder : function(node){

			$rootScope.form = [];

			$rootScope.form.node_id = node.data.tomo_node_id;
			$rootScope.form.name = node.text;
			$rootScope.form.unshare = 0;

			 if(node.original.sharedFolder || node.original.sharedRoot){
				 $rootScope.form.identfier = node.original.ident;
				 $rootScope.form.node_id = node.original.real_id;
				 $rootScope.form.unshare = 1;
			 }

			var title = $rootScope.form.unshare ? 'Descompartilhar' : 'Compartilhar'
			
			var options = {
					autoOpen: false,
					modal: false,
					title: $rootScope.Users.translateText(title),
					width: 500,
					height:'auto',
					resizable:false,
					dialogClass: "noclose", 
					dialogClass: "noclose no-scroll",
					create: function (event, ui) {
						$(event.target).parent().css('position', 'fixed');
					},
					close:function(){
						
					}
				};
				model = [];
				dialogService.open('shareFolder','shareFolder', model, options).then();
		},

		/**
		 * Calls backend method to share folder to other identfier
		 * */
		shareFolderConfirm : function(){

			if(!$rootScope.form.identfier){
				return;
			}

			self.isLoading = true;

			$.ajax({
				url: $rootScope.base_url+"/shared_folders/share_folder",
				data: {node_id: $rootScope.form.node_id,name: $rootScope.form.name,foreign_ident: $rootScope.form.identfier,unshare: $rootScope.form.unshare},
				type: "POST",
				success:function(response){
					self.isLoading = false;

					self.sharedFolders.push(response.data);
					
					$rootScope.set_errors_modal(response,"shareFolder");
					$rootScope.$apply();
				},
				error:function(response){
					self.isLoading = false;
					console.log("Uncaught error on shareFolder: ", response);
				}
			});
			
		},

		/**
		 * Calls backend method to share folder to other identfier
		 * */
		unShareFolderConfirm : function(folder){

			$rootScope.form.unshare = 1;

			self.isLoading = true;

			$.ajax({
				url: $rootScope.base_url+"/shared_folders/un_share_folder",
				data: {node_id: folder.node_id,name: folder.name,foreign_ident: folder.ident,db_tomodat: folder.db_tomodat},
				type: "POST",
				success:function(response){
					self.isLoading = false;

					if(response.data){

						if(!response.data.is_local){
					
							//recarregar mapwisp
							window.location.reload(true);

						}else{

							if(folder = $rootScope.Nodes.sharedFolders.findIndex(n=>n.id === response.id)){
								$rootScope.Nodes.sharedFolders.splice(folder,1);
							}
							
						}
					}
					
					$rootScope.set_errors_modal(response,"shareFolder");
					$rootScope.$apply();
				},
				error:function(response){
					self.isLoading = false;
					console.log("Uncaught error on shareFolder: ", response);
				}
			});
			
		},
	}
	
	return self;
	
})