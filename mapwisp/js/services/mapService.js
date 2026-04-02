app.service("Map", function(dialogService, $rootScope, $timeout, $interval, Functions, LevelsAndModes, Tour, Users, Tips) {

	var self = {
		map: false,
		mapEvent: false,
		viewAllCircles: false,
		showViewItemsMenu: false,
		showAddItemsMenu: false,
		showDropdownItemsMenu: false,
		isLoading: false,
		mapwispVersion: 2.0,
		jstree_ready: false,
		wide_sidebar: true,
		arrPosts: {},
		arrClients: {},
		tempRecentDraggedDot: false,
		pendingAddManyRequests: 0,

		/**
		 * Serial Add Open Modal method
		 * Opens the configuration modal for the serial adding functionality
		 * */
		serialAdd: function() {

			$rootScope.Cables.offEditCablePolyline();

			var options = {
				autoOpen: false,
				modal: false,
				title: $rootScope.Users.translateText("Adição em Série"),
				width: 250,
				height: "auto",
				resizable: true,
				position: {
					my: "left top",
					at: "left+10 top+80",
					of: window,
					collision: "none"
				},
				create: function(event, ui) {
					$(event.target).parent().css("position", "fixed");
				},
				close: function() {
					$rootScope.serialAdd = false;
					self.serialAdding = false;
					self.map.setOptions({ draggableCursor: "crosshair" });
				}
			};
			model = [];
			$rootScope.serialAdd = true;
			$rootScope.form.color = "#c0c0c0";
			$rootScope.dialogService.open("serialAddModal", "serialAddModal", model, options).then();
		},

		/**
		 * Serial Add Init
		 * Initializes the serial add function, by setting the "serialAdding" variable to true,  and setting the right mouse cursor
		 * */
		serialAddInit: function() {
			if (self.verifySerialAddForm()) {
				self.serialAdding = true;
				if ($rootScope.form.serial_add_type != 4) {
					//SET NAME BASE------------------------------
					self.serialAddCount = 0;
					split = $rootScope.form.name.split("+");
					if (typeof (split[1]) != undefined) {
						self.serialAddBaseNumber = +split[1];
					} else {
						self.serialAddBaseNumber = 1;
					}
					self.serialAddBaseName = split[0];
					//--------------------------------------------
				}
				//SET ICON FOR MAP--------------------------
				if ($rootScope.form.serial_add_type == 1) {
					//ARMARIO
					icone = $rootScope.base_url + "/img/icons_map/armario_cad.png";
				} else if ($rootScope.form.serial_add_type == 2) {
					//CX EMENDA
					icone = $rootScope.base_url + "/img/icons_map/caixa_emenda_cad.png";
				} else if ($rootScope.form.serial_add_type == 3) {
					//CX ATENDIMENTO
					icone = $rootScope.base_url + "/img/icons_map/caixa_atendimento_cad.png";
				} else if ($rootScope.form.serial_add_type == 4) {
					//POSTE
					icone = $rootScope.base_url + "/img/icons_map/poste_cad.png";
				}
				self.map.setOptions({ draggableCursor: "url(" + icone + "), crosshair" });
				//---------------------------------------------
			}
		},
		/**
		 * Serial add Stop method
		 * Stops the serial add function, by setting the serialAdding var to false, and correcting the map mouse cursor
		 * */
		serialAddStop: function() {
			self.serialAdding = false;
			self.map.setOptions({ draggableCursor: "crosshair" });
			$rootScope.form.name = "" + self.serialAddBaseName + "+" + (self.serialAddBaseNumber + self.serialAddCount);
		},

		verifySerialAddForm: function() {
			$rootScope.form.error = [];
			//EXISTENCE OF ITEM TYPE
			if (!$rootScope.form.serial_add_type) {
				$rootScope.form.error.serial_add_type = $rootScope.Users.translateText("Escolha o tipo de Item");
				$timeout(function() {
					$rootScope.form.error.serial_add_type = "";
				}, 4000);
				return false;
			}
			//EXISTENCE OF NAME
			if (($rootScope.form.serial_add_type != 4) && (!$rootScope.form.name)) {
				$rootScope.form.error.name = $rootScope.Users.translateText("Escolha o nome base para os itens");
				$timeout(function() {
					$rootScope.form.error.name = "";
				}, 4000);
				return false;
			}
			//If its not a post, check the name
			if ($rootScope.form.serial_add_type != 4) {
				//NAME HAS "+"
				if ($rootScope.form.name.indexOf("+") < 0) {
					$rootScope.form.error.name = $rootScope.Users.translateText("Adicione um '+' no fim do nome, para iteracao");
					$timeout(function() {
						$rootScope.form.error.name = "";
					}, 4000);
					return false;
				}
				//STRING AFTER "+" IN NAME IS CORRECT
				split = $rootScope.form.name.split("+");
				if ((typeof (split[1]) != undefined) && isNaN(split[1])) {
					$rootScope.form.error.name = $rootScope.Users.translateText("Escreva somente numeros apos o '+'.");
					$timeout(function() {
						$rootScope.form.error.name = "";
					}, 4000);
					return false;
				}
			}
			//EXISTENCE OF SPECIFIC TYPE
			if (($rootScope.form.serial_add_type == 1) && (!$rootScope.form.armario_access_point_type_id)) {
				$rootScope.form.error.armario_access_point_type_id = $rootScope.Users.translateText("Escolha um tipo de armario");
				$timeout(function() {
					$rootScope.form.error.armario_access_point_type_id = "";
				}, 4000);
				return false;
			}
			//EXISTENCE OF SPECIFIC TYPE
			if (($rootScope.form.serial_add_type == 2) && (!$rootScope.form.emenda_access_point_type_id)) {
				$rootScope.form.error.emenda_access_point_type_id = $rootScope.Users.translateText("Escolha um tipo de caixa de emenda");
				$timeout(function() {
					$rootScope.form.error.emenda_access_point_type_id = "";
				}, 4000);
				return false;
			}
			//EXISTENCE OF SPECIFIC TYPE
			if (($rootScope.form.serial_add_type == 3) && (!$rootScope.form.atend_access_point_type_id)) {
				$rootScope.form.error.atend_access_point_type_id = $rootScope.Users.translateText("Escolha um tipo de caixa de atendimento");
				$timeout(function() {
					$rootScope.form.error.atend_access_point_type_id = "";
				}, 4000);
				return false;
			}
			//        	   if(!$rootScope.Projects.projectSelected){
			//                   $rootScope.message_error = 'Selecione um projeto';
			//                   $timeout(function() {
			//                     $rootScope.message_error = '';
			//                   }, 3000);
			//                   return false;
			//        	   }
			return true;
		},

		/**
		 * Add serial Item method
		 * This is called at every click on the map, as long as the variable "serialAdding" is set to true
		 * The right type of item has to be verified, and then its add method is called.
		 * */
		addSerialItem: function() {
			if ($rootScope.form.serial_add_type != 4 && $rootScope.form.serial_add_type != 6) {
				num = self.serialAddBaseNumber + self.serialAddCount;
				$rootScope.form.name = "" + self.serialAddBaseName + "" + num;
				self.serialAddCount = self.serialAddCount + 1;
			}
			if ($rootScope.form.serial_add_type == 1) {
				//ARMARIO
				$rootScope.form.access_point_type_id = $rootScope.form.armario_access_point_type_id;
				$rootScope.accessPointCategory = 2;
				$rootScope.AccessPoints.addConfirm();
			} else if ($rootScope.form.serial_add_type == 2) {
				//CX EMENDA
				$rootScope.form.access_point_type_id = $rootScope.form.emenda_access_point_type_id;
				$rootScope.accessPointCategory = 4;
				$rootScope.AccessPoints.addConfirm();
			} else if ($rootScope.form.serial_add_type == 3) {
				//CX ATENDIMENTO
				$rootScope.form.access_point_type_id = $rootScope.form.atend_access_point_type_id;
				$rootScope.accessPointCategory = 5;
				$rootScope.AccessPoints.addConfirm();
			} else if ($rootScope.form.serial_add_type == 4) {
				//POSTE
				$rootScope.Posts.addConfirm();
			} else if ($rootScope.form.serial_add_type == 6) {
				//CAMERA
				$rootScope.form.access_point_type_id = $rootScope.form.camera_access_point_type_id;
				$rootScope.accessPointCategory = 6;
				$rootScope.AccessPoints.addConfirm();
			}
		},

		/**
		 * Show Elements Method
		 * Shows all the elements in the "elements" array
		 *
		 *
		 * */
		showElements: function(nodes, show) {
			angular.forEach(nodes, function(node, index) {
				$timeout(function() {
					/*
					 * CATEGORY
					 * 1 = Pastas
					 * 2 = Access Points
					 * 3 = Cables
					 * 4 = Clients
					 * 5 = Posts
					 *
					 * */
					if (show) {
						var map = self.map;
					} else {
						var map = null;
					}

					//AccessPoints
					if (node.data.category == 2) {
						if ($rootScope.AccessPoints.accessPoints[node.data.tomo_type_index][node.data.tomo_index].dot) {
							//$rootScope.AccessPoints.accessPoints[node.data.tomo_type_index][node.data.tomo_index].dot.setMap(map);
							var ap = $rootScope.AccessPoints.accessPoints[node.data.tomo_type_index][node.data.tomo_index];
							var marker = $rootScope.AccessPoints.accessPoints[node.data.tomo_type_index][node.data.tomo_index].dot;

							if (map && $rootScope.Nodes.onOffDeployed($rootScope.AccessPoints.accessPoints[node.data.tomo_type_index][node.data.tomo_index])) {
								if (node.data.tomo_type_index == 1) {
									$rootScope.Markers.addToMap(marker);
								} else if (node.data.tomo_type_index == 2) {
									if ($rootScope.user_data.user_setting.show_racks) {
										$rootScope.Markers.addToMap(marker);
									} else {
										$rootScope.Markers.removeFromMap(marker);
									}
								} else if (node.data.tomo_type_index == 3) {
									if ($rootScope.user_data.user_setting.show_pacs) {
										$rootScope.Markers.addToMap(marker);
									} else {
										$rootScope.Markers.removeFromMap(marker);
									}
								} else if (node.data.tomo_type_index == 4) {
									if ($rootScope.user_data.user_setting.show_cx_em) {
										$rootScope.Markers.addToMap(marker);
									} else {
										$rootScope.Markers.removeFromMap(marker);
									}
								} else if (node.data.tomo_type_index == 5) {
									if ($rootScope.user_data.user_setting.show_cx_at) {
										if ($rootScope.Painel.show_only_deployeds_aps &&
											$rootScope.Painel.show_only_deployeds_aps.value &&
											LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_COMERCIAL]) &&
											(!ap.deploy_information || (ap.deploy_information && !ap.deploy_information.deployed))) {

											$("#jstree-sidebar-div").jstree().hide_node(node, true);

											if (node.state.checked) {
												$("#jstree-sidebar-div").jstree().uncheck_node(node);
												// Put this node in an array, to recheck it once its asked for.
												$rootScope.Nodes.recheck_nodes.push(node);
											}
											$rootScope.Markers.removeFromMap(marker);
											$("#jstree-sidebar-div").jstree().redraw(true);
										} else {
											$rootScope.Markers.addToMap(marker);
										}
									} else {
										$rootScope.Markers.removeFromMap(marker);
									}
								} else if (node.data.tomo_type_index == 6) {
									// Cameras (category 6)
									if ($rootScope.user_data.user_setting.show_cameras) {
										$rootScope.Markers.addToMap(marker);
									} else {
										$rootScope.Markers.removeFromMap(marker);
									}
								}
							} else {
								$rootScope.Markers.removeFromMap(marker);
								//Esconder nodo na treeview
								//$('#jstree-sidebar-div').jstree().hide_node(node);
							}
						}
					}

					//Cables
					else if (node.data.category == 3) {
						if (!$rootScope.Cables.cables[node.data.tomo_type_index]) {
							return; //evitar bug se array vazio
						}
						var cable = $rootScope.Cables.cables[node.data.tomo_type_index][node.data.tomo_index];
						var cableType = $rootScope.Cables.cableTypes[1].find(c => c.id === cable.cable_type_id);
						if (cable && cable.polyline) {
							if ($rootScope.user_data.user_setting.show_cables && $rootScope.Nodes.onOffDeployed(cable)
								&& $rootScope.Nodes.showCableType(cableType)) {
								cable.polyline.setMap(map);
								if ($rootScope.Reserves.viewAllReserves) {
									$rootScope.Reserves.setCableReservesMap(cable.id, map);
								}
							} else {
								cable.polyline.setMap(null);
							}
						}
					}

					//Clients
					else if (node.data.category == 4) {
						var client = $rootScope.Clients.clients[node.data.tomo_index];
						if (client.marker) {
							//$rootScope.Clients.clients[node.data.tomo_index].marker.setMap(map);
							var marker = client.marker;
							if (map && $rootScope.user_data.user_setting.show_clients
								&& $rootScope.Nodes.onOffDeployed(client)) {
								$rootScope.Markers.addToMap(marker, $rootScope.Markers.clientsMarkerCluster);
							} else {
								$rootScope.Markers.removeFromMap(marker, $rootScope.Markers.clientsMarkerCluster);
								// 									return; //evitar desenhar cabo drop sem cliente
							}
						}
						//also show/hide the drop cable related to id, if its there
						if (client.drop_cable_id) {
							var cable_drop = $rootScope.Cables.cables[4].filter(obj => obj.id === client.drop_cable_id)[0];
							if (cable_drop) {
								if (cable_drop.polyline && $rootScope.user_data.user_setting.show_clients) {
									cable_drop.polyline.setMap(map);
								} else {
									cable_drop.polyline.setMap(null);
								}
							}
						}
					}

					//Posts
					else if (node.data.category == 5) {
						var post = $rootScope.Posts.posts[node.data.tomo_index];
						if (post.dot) {
							//$rootScope.Posts.posts[node.data.tomo_index].dot.setMap(map);
							var marker = post.dot;
							if (map && $rootScope.user_data.user_setting.show_posts
								&& $rootScope.Nodes.onOffDeployed(post)) {
								$rootScope.Markers.addToMap(marker, $rootScope.Markers.postsMarkerCluster);
							} else {
								$rootScope.Markers.removeFromMap(marker, $rootScope.Markers.postsMarkerCluster);
							}
						}
					}

					//Buildings
					else if (node.data.category == 9) {
						var building = $rootScope.Buildings.buildings[node.data.tomo_index];
						if (building.dot) {
							var marker = building.marker;
							if (map && $rootScope.user_data.user_setting.show_buildings
								&& $rootScope.Nodes.onOffDeployed(building)) {
								$rootScope.Markers.addToMap(marker);
							} else {
								$rootScope.Markers.removeFromMap(marker);
							}
						}
					}

				}, 0);
			});
		},


		/**
		 * TreeView Select method
		 * Called when a node in the treeview is selected.
		 *
		 * Check which node was selected, and which of the children werent selected yet, and show thos on the map.
		 *
		 *
		 * */
		treeview_select: function(data) {
			var i, j;
			r = [];
			if (data.node.data.leaf) {
				r.push(data.node);
			}
			for (i = 0, j = data.node.children_d.length; i < j; i++) {
				current_node = data.instance.get_node(data.node.children_d[i]);
				if (current_node.data.leaf && !current_node.state.checked) {
					r.push(current_node);
				}
			}

			$rootScope.Nodes.changeNodeState(data.node);

			//Show elements
			self.showElements(r, true);
			$rootScope.Views.updateViewNodes(r, true);
		},

		/**
		 * TreeView Deselect method
		 * Called when a node in the treeview is deselected
		 *
		 * Check which node was deselected, and which of the children were selected, and hide those from the map
		 *
		 * */
		treeview_deselect: function(data) {
			var i, j;
			r_leaf = [];
			r_total = [];
			r_total.push(data.node);
			if (data.node.data.leaf) {
				r_leaf.push(data.node);
			}
			for (i = 0, j = data.node.children_d.length; i < j; i++) {
				current_node = data.instance.get_node(data.node.children_d[i]);
				if (current_node.state.checked) {
					r_total.push(current_node);
					if (current_node.data.leaf) {
						r_leaf.push(current_node);
					}
				}
			}

			$rootScope.Nodes.changeNodeState(data.node);

			//Hide elements
			self.showElements(r_leaf, false);
			$rootScope.Views.updateViewNodes(r_total, false);
		},

		/**
		 * Mostra qualquer popup de informação ou pesquisa, se necessário
		 */
		showInitialPopups: function() {
			$rootScope.Surveys.showActiveSurvey();
		},

		/**
		 * Search callback for jstree, to add custom search method
		 * OPTIMIZED: Uses lookup maps, early exits, and caching for better performance
		 */
		jsTreeSearch: function(searchString, node) {
			// OPTIMIZATION: Lowercase search string once, not per node
			var searchLower = searchString.toLowerCase();
			
			// OPTIMIZATION: Early exit for simple text match (most common case)
			if (node.text.toLowerCase().includes(searchLower)) {
				return true;
			}

			// If node is a post, search id_concessionaria as well
			if (node.data.category == 5) {
				// OPTIMIZATION: Use Map/object lookup instead of Array.find() for O(1) access
				// Build lookup map in postsService after posts are loaded
				var post = ($rootScope.Posts.postsMap && $rootScope.Posts.postsMap[node.data.tomo_id]) || 
				           $rootScope.Posts.posts.find(p => p.id === node.data.tomo_id); // Fallback if map not available
				if (post && post.id_concessionaria && post.id_concessionaria.toLowerCase().includes(searchLower)) {
					return true;
				}
			}

			// If is a building, search inside for access points, cables and clients
			if (node.data.category == 9) {
				// OPTIMIZATION: Skip expensive building search if search string is too short
				if (searchString.length < 2) {
					return false;
				}
				
				var building = $rootScope.Buildings.buildings[node.data.tomo_index];
				if (!building) {
					return false;
				}

				// OPTIMIZATION: Cache building searchable text to avoid repeated expensive operations
				if (!building._searchableText) {
					var searchable = [];
					
					// Search cables
					if (building.cables) {
						building.cables.forEach(function(c) {
							if (c.name) searchable.push(c.name);
						});
					}

					// On each floor
					if (building.floors) {
						building.floors.forEach(function(buildingFloor) {
							// Search access points
							if (buildingFloor.access_points) {
								buildingFloor.access_points.forEach(function(buildingAccessPoint) {
									if (buildingAccessPoint.name) searchable.push(buildingAccessPoint.name);
								});
							}

							// Search clients on each apartment
							if (buildingFloor.apartments) {
								buildingFloor.apartments.forEach(function(apartment) {
									if (apartment.client && apartment.client.name) {
										searchable.push(apartment.client.name);
									}
								});
							}
						});
					}
					
					// Cache the combined searchable text
					building._searchableText = searchable.join(' ').toLowerCase();
				}
				
				// Use cached searchable text for fast lookup
				return building._searchableText.includes(searchLower);
			}

			return false;
		},

		initialize_treeview: function(tree_data) {
			var init_treeview_start = new Date().getTime();
			//Initiate jstree:

			//Untie selection to checkbox.
			$.jstree.defaults.checkbox.tie_selection = false;
			$.jstree.defaults.checkbox.whole_node = false;

			//Dont select node when context menu is called on it
			$.jstree.defaults.contextmenu.select_node = false;

			if (LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_VIEW])
				|| LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_VIEWEXPORT])) {
				$.jstree.defaults.plugins = ["checkbox", "search", "contextmenu", "sort"];
			} else {
				$.jstree.defaults.plugins = ["checkbox", "dnd", "search", "contextmenu", "sort"];
			}

			if ($rootScope.user_data && $rootScope.user_data.user_setting && $rootScope.user_data.user_setting.auto_save) {
				$.jstree.defaults.plugins.push("state");
			}

			//Carrega os seguintes plugins:
			//    if ($rootScope.user_data && $rootScope.user_data.user_setting && $rootScope.user_data.user_setting.auto_save){
			// 	   $.jstree.defaults.plugins = ["checkbox", "dnd", "search", "contextmenu", "sort"];
			//    } else{
			// 	   $.jstree.defaults.plugins = ["checkbox", "dnd", "search", "contextmenu", "sort", "state"];
			//    }

			//salva estado da treeview para cada bd
			if ($rootScope.identifier) { //condição temporaria ate corrigir company undefined
				$.jstree.defaults.state.key = [$rootScope.identifier.company_name];
			}

			// Add custom search method
			$.jstree.defaults.search.search_callback = self.jsTreeSearch;

			//Definindo a ordem dos nodos na arvore - ordem de categoria: pastas, aps, cabos, clients.
			$.jstree.defaults.sort = function(a, b) {
				// Nodos de integração primeiro:
				var nodeName = this.get_node(a).text;
				if (nodeName == "SmartOLT" || nodeName == "HUBSOFT - INTEGRAÇÃO" || nodeName == "IntegraOLT") {
					// Set integration color on node
					this.get_node(a).a_attr.class = "jstree-integration-node";
					return -1;
				}

				if (this.get_node(a).data.category > this.get_node(b).data.category) {
					return 1;
				}
				if (this.get_node(a).data.category < this.get_node(b).data.category) {
					return -1;
				}
				if (this.get_node(a).data.category == 2) {
					if (this.get_node(a).data.tomo_type_index > this.get_node(b).data.tomo_type_index) {
						return 1;
					} else if (this.get_node(a).data.tomo_type_index < this.get_node(b).data.tomo_type_index) {
						return -1;
					}
				}
				str_a = this.get_node(a).text.toLowerCase();
				str_b = this.get_node(b).text.toLowerCase();
				if (str_a < str_b) {
					return -1;
				}
				if (str_a > str_b) {
					return 1;
				}
				return 0;
			};

			//Desativando duplo clique para abrir pasta. Duplo clique somente seleciona a pasta para cadastro
			$.jstree.defaults.core.dblclick_toggle = false;

			//Removendo multiple drag
			//$.jstree.defaults.core.multiple = false;

			//Criando menu de contexto para botao direito nos nodos.
			$.jstree.defaults.contextmenu.items = function(node) {

				//Impedir menu treeview no level view e comercial
				if (LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_COMERCIAL])) {
					return false;
				}

				var folder = $rootScope.Nodes.nodes.find(n => n.id === node.data.tomo_node_id);

				var items = {
					"add": {
						"label": $rootScope.Users.translateText("Adicionar Pasta"),
						"action": function(action_data) {
							//Criar dados do nodo para salvar no BD
							data = {};
							data.parent_id = node.data.tomo_node_id;
							data.leaf = 0;
							data.checked = 0;
							data.selected = 0;
							data.category = 1;
							data.name = $rootScope.Users.translateText("Nova Pasta");
							//Salva nodo, e espera receber id
							var new_node_id = $rootScope.Nodes.addSync(data);

							//Adiciona nodo na arvore
							var parent = node.id;
							var new_node = { text: $rootScope.Users.translateText("Nova Pasta"), data: { "category": 1, "tomo_node_id": new_node_id }, icon: $rootScope.base_url + "/img/icons_map/folder.svg" };
							var node_added = $("#jstree-sidebar-div").jstree("create_node", parent, new_node, "first");
							//Automaticamente colocar nodo para renomear
							var inst = $.jstree.reference(node_added);
							var obj = inst.get_node(node_added);
							inst.edit(obj);
							//Mark the saving folder again.
							$rootScope.Nodes.setStrongWeight();
						},
						"icon": $rootScope.base_url + "/img/icons_menu/folder-plus.svg"
					},
					"remove": {
						"label": $rootScope.Users.translateText("Deletar"),
						"action": function(data) {
							var inst = $.jstree.reference(data.reference),
								obj = inst.get_node(data.reference);
							// Only deleting if its an empty folder. If folder has content,
							// the option 'removecontent' has to be used
							if (obj.children.length == 0 && (obj.data.category == 1)) {
								inst.delete_node(obj);
							}
							//Mark the saving folder again.
							$rootScope.Nodes.setStrongWeight();
						},
						"icon": $rootScope.base_url + "/img/icons_menu/bin.svg"
					},
					"removecontent": {
						"label": $rootScope.Users.translateText("Deletar Conteúdo da Pasta"),
						"action": function(data) {
							var inst = $.jstree.reference(data.reference),
								obj = inst.get_node(data.reference);
							$rootScope.Nodes.deleteContent(obj);
							//Mark the saving folder again.
							$rootScope.Nodes.setStrongWeight();
						},
						"icon": $rootScope.base_url + "/img/icons_menu/bin.svg"
					},
					"edit_item": {
						"label": $rootScope.Users.translateText("Editar"),
						"action": function(data) {
							var inst = $.jstree.reference(data.reference);
							obj = inst.get_node(data.reference);

							if (obj.data.category === 1) {
								inst.edit(obj);
							} else if (obj.data.category === 2) {
								$rootScope.AccessPoints.edit(obj.data.tomo_id, obj.data.tomo_type_index);
							} else if (obj.data.category === 9) {
								$rootScope.Buildings.edit(obj.data.tomo_id);
							} else if (obj.data.category === 4) {
								$rootScope.Clients.edit(obj.data.tomo_id);
							} else if (obj.data.category === 3) {
								$rootScope.Cables.edit(obj.data.tomo_id, obj.data.tomo_type_index);
							} else if (obj.data.category === 5) {

								$rootScope.Posts.selectedPost = $rootScope.Posts.posts.find(p => p.id === obj.data.tomo_id);
								$rootScope.Posts.edit();
							}

							//Mark the saving folder again.
							$rootScope.Nodes.setStrongWeight();
						},
						"icon": $rootScope.base_url + "/img/icons_menu/pencil.svg"
					},
					"show_content": {
						"label": $rootScope.Users.translateText("Mostrar conteudo no mapa"),
						"action": function(data) {
							var inst = $.jstree.reference(data.reference),
								obj = inst.get_node(data.reference);
							$rootScope.Nodes.showContentOnMap(obj);
							//Mark the saving folder again.
							$rootScope.Nodes.setStrongWeight();
						},
						"icon": $rootScope.base_url + "/img/icons_menu/eye.svg"
					},
					"export_kml": {
						"label": $rootScope.Users.translateText("Exportar KML"),
						"action": function(data) {
							var inst = $.jstree.reference(data.reference),
								obj = inst.get_node(data.reference);
							self.exportKmzKml(obj);
							//Mark the saving folder again.
							$rootScope.Nodes.setStrongWeight();
						},
						"icon": $rootScope.base_url + "/img/icons_menu/share.svg"
					},
					"cost_report": {
						"label": $rootScope.Users.translateText("Relatório de custo"),
						"action": function(data) {
							var inst = $.jstree.reference(data.reference),
								obj = inst.get_node(data.reference);

							$rootScope.RegionReports.regionCostReport(obj.data.tomo_node_id);

							//Mark the saving folder again.
							$rootScope.Nodes.setStrongWeight();
						},
						"icon": $rootScope.base_url + "/img/icons_menu/file-text2.svg"
					},
					"share_folder": {
						"label": $rootScope.Users.translateText("Compartilhamento"),
						"action": function(data) {
							var inst = $.jstree.reference(data.reference),
								obj = inst.get_node(data.reference);

							$rootScope.Nodes.shareFolder(node);

							//Mark the saving folder again.
							$rootScope.Nodes.setStrongWeight();
						},
						"icon": $rootScope.base_url + "/img/icons_menu/share2.svg"
					}
				}

				if (node.data.category != 1) {
					delete items.add;
					//delete items.rename;
					delete items.show_content;
					delete items.export_kml;
					delete items.removecontent;
					delete items.cost_report;
					delete items.share_folder;
				}

				//remove opções caso seja pasta compartilhada
				if (node.original.sharedRoot) {
					delete items.add;
					delete items.rename;
					delete items.show_content;
					delete items.removecontent;
				}
				if (node.original.shared) {
					delete items.add;
					delete items.remove;
					delete items.rename;
					delete items.show_content;
					delete items.removecontent;
					delete items.share_folder;
				}

				// Integration nodes should not be renamed
				if (node.text === "SmartOLT" || node.text === "HUBSOFT - INTEGRAÇÃO") {
					delete items.rename;
				}

				if (!((node.data.category == 1) && (node.children.length == 0))) {
					delete items.remove;
				}

				if ((node.parents.length <= 1) || (!LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR]))) {
					delete items.share_folder;
				}

				//Usuário view só pode exportar kml
				if (LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_VIEW])) {
					delete items.add;
					delete items.rename;
					delete items.edit_item;
					delete items.show_content;
					delete items.remove;
					// The user can export kml files, depending on a default value flag
					if ($rootScope.DefaultValues.block_kml_export_for_view
						&& $rootScope.DefaultValues.block_kml_export_for_view.value == true
					) {
						delete items.export_kml;
					}
					delete items.removecontent;
					delete items.cost_report;
					delete items.share_folder;
				}

				//Usuário VIEWEXPORT só pode exportar kml
				if (LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_VIEWEXPORT])) {
					delete items.add;
					delete items.rename;
					delete items.edit_item;
					delete items.show_content;
					delete items.remove;
					delete items.removecontent;
					delete items.cost_report;
					delete items.share_folder;

					// delete items.export_kml;
				}

				return items;
			};

			//Para Busca na arvore
			// OPTIMIZATION: Increased debounce timeout and added minimum search length
			var to = false;
			$("#treeview-search").keyup(function() {
				if (to) { clearTimeout(to); }
				to = setTimeout(function() {
					var v = $("#treeview-search").val();
					// OPTIMIZATION: Only search if 2+ characters (reduces unnecessary searches)
					if (v.length >= 2) {
						$("#jstree-sidebar-div").jstree(true).search(v);
					} else if (v.length === 0) {
						// Clear search if input is empty
						$("#jstree-sidebar-div").jstree(true).clear_search();
					}
				}, 500); // OPTIMIZATION: Increased from 250ms to 500ms for better UX
			});

			$rootScope.clicks = 0;
			$rootScope.clicksTimer = 0;
			$rootScope.clicksInTreeview = false;

			//Definindo acoes a serem tomadas para selecao, deselecao, e duplo clique
			$("#jstree-sidebar-div")
				.on("ready.jstree", function(e, data) {
					self.jstree_ready = true;
					$rootScope.Nodes.verifyToggle(); //caso o toggle não esteja ativo esconde o item
				})
				.on("check_node.jstree", function(e, data) {
					self.treeview_select(data);
					$rootScope.clicksInTreeview = true;
				})
				.on("uncheck_node.jstree", function(e, data) {
					self.treeview_deselect(data);
					$rootScope.clicksInTreeview = true;
				})
				.on("select_node.jstree", function(e, data) {
					//For eventual use
				})
				.on("deselect_node.jstree", function(e, data) {
					//For eventual use
				})
				.on("dblclick.jstree", function(e, data) {
					node = $("#jstree-sidebar-div").jstree().get_node(e.target);

					var folder = $rootScope.Nodes.nodes.find(n => n.id === node.data.tomo_node_id);

					if (node.data.category == 1 && !folder.ident) {
						$rootScope.Nodes.setAsSavingFolder(node);
					} else {
						if (node.data.leaf) {
							self.goto_element(node.data);
						}
					}
				}).on("click.jstree", function(e, data) {

					$rootScope.clicks++;  //count clicks

					//verifica se foi dado o segundo click e se não foi clickado no checkbox
					if ($rootScope.clicks === 1 && !$rootScope.clicksInTreeview) {

						node = $("#jstree-sidebar-div").jstree().get_node(e.target);

						$rootScope.clicksTimer = setTimeout(function() {

							if ($rootScope.nodePreSelected) {
								if ($rootScope.nodePreSelected.id === node.id) {
									$("#jstree-sidebar-div").jstree().edit(node);
									//Mark the saving folder again.
									$rootScope.Nodes.setStrongWeight();
									return;
								}
							}
							$rootScope.nodePreSelected = node;  //perform single-click action
							$rootScope.clicks = 0;             //after action performed, reset counter

						}, 700);

					} else {

						clearTimeout($rootScope.clicksTimer);    //prevent single-click action
						$rootScope.clicks = 0;             //after action performed, reset counter
						$rootScope.clicksInTreeview = false;
					}
				})
				.on("close_node.jstree", function(e, data) {
					$rootScope.clicksInTreeview = true;
				})
				.on("open_node.jstree", function(e, data) {
					$rootScope.clicksInTreeview = true;
				})
				.on("hover_node.jstree", function(e, data) {
					// Se não for uma pasta, não faz contagem
					if (data.node.data.category !== 1) {
						$("#" + data.node.id).prop("title", "");
						return;
					}

					if (data.node.original.shared || data.node.original.sharedRoot) {
						// o texto é mostrado no hover
						$("#" + data.node.id).prop("title", data.node.original.ident);
						return;
					}

					// Get backend folder contents
					$.ajax({
						url: $rootScope.base_url + "/folder_contents/get",
						data: { id: data.node.data.tomo_node_id },
						type: "POST",
						success: function(response) {
							// console.log("Response: ", response);

							var contentText = "";

							if (response) {
								var folderContent = JSON.parse(response.content_json);

								// GENERATE TEXT
								var dateUpdated = new Date(response.date_updated);

								if (folderContent.subfolders > 0) {
									contentText = contentText + "\nPastas:\t" + folderContent.subfolders;
								}
								if (folderContent.cables > 0) {
									contentText = contentText + "\nCabos:\t" + folderContent.cables;
								}
								if (folderContent.clients > 0) {
									contentText = contentText + "\nClientes:\t" + folderContent.clients;
								}
								if (folderContent.buildings > 0) {
									contentText = contentText + "\nPrédios:\t" + folderContent.buildings;
								}
								if (folderContent.spliceboxes > 0) {
									contentText = contentText + "\nCaixas de Emenda:\t" + folderContent.spliceboxes;
								}
								if (folderContent.serviceboxes > 0) {
									contentText = contentText + "\nCaixas de Atendimento:\t" + folderContent.serviceboxes;
								}
								if (folderContent.pacs > 0) {
									contentText = contentText + "\nPACs:\t" + folderContent.pacs;
								}
								if (folderContent.sources > 0) {
									contentText = contentText + "\nFontes:\t" + folderContent.sources;
								}
								if (folderContent.racks > 0) {
									contentText = contentText + "\nRacks:\t" + folderContent.racks;
								}
								if (folderContent.posts > 0) {
									contentText = contentText + "\nPostes:\t" + folderContent.posts;
								}

								if (contentText.length > 0) {
									var contentText = "CONTEÚDO DA PASTA\n[Atualizado às "
										+ (dateUpdated.getHours() < 10 ? "0" : "") + dateUpdated.getHours() + ":"
										+ (dateUpdated.getMinutes() < 10 ? "0" : "") + dateUpdated.getMinutes() + "]\n"
										+ contentText;
								} else {
									var contentText = "PASTA VAZIA\n[Atualizado às "
										+ dateUpdated.getHours() + ":"
										+ dateUpdated.getMinutes() + "]";
								}

							}

							var isShared = $rootScope.Nodes.sharedFolders.filter(n => n.node_id === data.node.data.tomo_node_id && n.is_local);

							if (isShared.length > 0) {
								contentText = contentText + "\nCompartilhado com:\t";

								for (sharedfolder of isShared) {
									contentText = contentText + "\n" + sharedfolder.ident;
								}

							}

							// Seta a propriedade title do nodo para "msg". Dessa forma
							// o texto é mostrado no hover
							$("#" + data.node.id).prop("title", contentText);
							// -------------
						},
						error: function() {
							// EM CASO DE ERRO
						},
						complete: function() {
							// INVARIAVELMENTE NO FINAL
						}
					});
				});

			//Inicia e configura a arvore
			$("#jstree-sidebar-div").jstree({
				"core": {
					"data": [tree_data],
					// Check Callback pode ser false, para impedir qualquer modificação na treview,
					// true, para permitir alterações,
					// ou uma função para ter mais controle. Abaixo definimos como falso se for usuário view ou viewexport,
					// ou uma função se for qualquer outro nível de usuário.
					"check_callback": LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_VIEW, LevelsAndModes.levels.NIVEL_VIEWEXPORT]) ?
						false
						:
						function(operation, node, node_parent, node_position, more) {
							// Operation can be 'create_node', 'rename_node', 'delete_node', 'move_node' or 'copy_node'

							function checkFolder(node) {

								if (!node.data) {
									return false;
								}

								var folder = $rootScope.Nodes.nodes.find(n => n.id === node.data.tomo_node_id);

								if (folder.ident || folder.real_parent_id) {
									return true;
								}

							}

							function isSharedFolder(node) {

								if (checkFolder(node)) {
									return true;
								}

								for (parent_folder of node.parents) {

									if (checkFolder(parent_folder)) {
										return true;
									}
								}
								return false;
							}

							//Drag and drop node:
							if (operation == "move_node") {

								//verifica se é de pasta compartilhada
								if (isSharedFolder(node) || isSharedFolder(node_parent)) {
									return false;
								}

								if (more.dnd) {
									if (more.ref.data.category == 1) {
										return true;
									} else {
										return false;
									}
								} else {
									//Item finishes moving here
									//Edit node
									data = {};
									data.id = node.data.tomo_node_id;
									data.parent_id = node_parent.data.tomo_node_id;
									$rootScope.Nodes.edit(data);
									return true;
								}
								//Mark the saving folder again.
								$rootScope.Nodes.setStrongWeight();
							} else if (operation == "create_node") {
								//clear hover title
								$("#" + node_parent.id).prop("title", "");
								return true;
							} else if (operation == "rename_node") {
								//Set a timeout, to get the new name of the node
								setTimeout(function() {
									data = {};
									data.id = node.data.tomo_node_id;
									data.name = node.text;
									$rootScope.Nodes.edit(data);

									if (node.data.category === 2) {
										$rootScope.AccessPoints.rename(node.data.tomo_id, data.name);
									} else if (node.data.category === 9) {
										$rootScope.Buildings.rename(node.data.tomo_id, data.name);
									} else if (node.data.category === 4) {
										$rootScope.Clients.rename(node.data.tomo_id, data.name);
									} else if (node.data.category === 3) {
										$rootScope.Cables.rename(node.data.tomo_id, data.name);
									} else if (node.data.category === 5) {
										$rootScope.Posts.rename(node.data.tomo_id, data.name);
									}

									//Mark the saving folder again.
									$rootScope.Nodes.setStrongWeight();
								}, 10);
							} else if (operation == "delete_node") {
								data = {};
								data.id = node.data.tomo_node_id;
								$rootScope.Nodes.deleteNode(data);
								//Mark the saving folder again.
								$rootScope.Nodes.setStrongWeight();
								//clear hover title
								$("#" + node_parent.id).prop("title", "");
							}
						},
				}
			});

			//Seta para true, para mostrar div com a treeview.
			$rootScope.treeview = true;
			//Resize map to correct width [wait 10ms to get the new value]
			setTimeout(function() {
				var width_map = $("#map_container").css("width");
				$("#map").css("width", width_map);
				google.maps.event.trigger(self.map, "resize");
			}, 10);

			//GOOGLE ANALYTICS TIME ANALYSIS
			//Time from start to TreeView load:
			var finished_treeview_load = new Date().getTime();
			var start_treeviewload_time = finished_treeview_load - $rootScope.analytics_timing.start;
			console.log("STARTUP TIME: " + (start_treeviewload_time / 1000).toFixed(2));
			if ($rootScope.run_analytics) {
				ga("send", {
					hitType: "timing",
					timingCategory: "Load everything",
					timingVar: "load",
					timingValue: start_treeviewload_time
				});
			}
			$rootScope.initial_loading = false;

			if (LevelsAndModes.isMode([LevelsAndModes.modes.MODO_MONITOR])) {
				self.signalReloadInterval(true);
			} else {
				self.signalReloadInterval(false);
			}

			// Set user as online right now
			$.ajax({
				url: $rootScope.base_url + "/users/still_online",
				type: "POST",
				success: function(data) { }
			});

			// Update controls table
			if ($rootScope.Users.current_user.id !== 10000) {
				$.ajax({
					url: $rootScope.base_url + "/users/update_controls_table",
					type: "POST",
					success: function(data) {
						console.log("update controls table", data);
					}
				});
			}

			var init_treeview_end = new Date().getTime();
			var init_treeview_time = init_treeview_end - init_treeview_start;
			console.log("INIT TREEVIEW TIME: " + (init_treeview_time / 1000).toFixed(2));

			$rootScope.treeviewIsInitialized = true;

			if (Users.current_user.user_setting && Users.current_user.user_setting.show_tips && $rootScope.Tips.tip) {
				Tips.offerTip();
			}

			// Chama service Tour pra inicializar a tour somente se for o primeiro login
			if (Users.current_user.last_online == null && Users.current_user.company_id != 2 && $rootScope.Users.current_user.id != 10000) {
				Tour.offerTour();
			} else if ($rootScope.Users.current_user.id != 10000) {
				// Se NAO for primeiro login E NAO for usuário de suporte, verifica se deve mostrar release notes
				var currentMapwispVersion = "2.17.31";
				if (Users.current_user.tomodat_version !== currentMapwispVersion) {
					// Show release notes modal for ANY version change (major or minor)
					// This ensures all users see new release notes when they login after an update
					self.showReleaseNotes(false);
					
					// Also set alert for menu (visual indicator)
					self.newReleaseNotesAlert = true;
					
					// Write new version to user data
					Users.setUserVersion(currentMapwispVersion);
				}
			}

			// Mostra avisos se tiver algum ativo
			self.showNotices();

			// Inicia localizacao de usuarios se for user admin
			if (Users.current_user.level === 3) {
				$rootScope.LiveLocation.init();
			}

			// 30/12/2024 - Removendo teste de latencia por enquanto
			// Send latency test request
			// $.ajax({
			//     url:  $rootScope.base_url+"/latency_test",
			//     type: "GET",
			//     //async:false,
			//     success:function(){
			//         console.log("> latency test done.");
			//     },
			// });
		},

		/**
			* Expects the two parameters to be a string with 3 numbers,
			* sepparated by dots.
			* If only the last number is changed, its a minor version change
			* so the method returns FALSE.
			* Otherwise, if one of the 2 first numbers are changed, returns TRUE,
			* because its a major version change.
			*
			* NOTE: This function is kept for backward compatibility but is no longer
			* used to determine if release notes should be shown. Now ALL version changes
			* trigger the release notes modal automatically.
			*
			* @param {*} userVersion
			* @param {*} newVersion
			*/
		isMajorVersionChange: function(userVersion, newVersion) {
			if (typeof userVersion === "undefined" ||
				typeof newVersion === "undefined" ||
				userVersion === "" ||
				newVersion === "" ||
				userVersion === null ||
				newVersion === null) {
				return false;
			}
			userVersionArray = userVersion.split(".");
			newVersionArray = newVersion.split(".");
			if ((userVersionArray[0] != newVersionArray[0])
				|| (userVersionArray[1] != newVersionArray[1])) {
				return true;
			} else if (userVersionArray[2] != newVersionArray[2]) {
				return false;
			}
			return false;
		},

		showNotices: function() {
			console.info("No notices do show, skipping.");
		},

		// Dismiss notice
		dismissNotice: function() {
			localStorage.setItem('notice_dismissed_price_update_jul_2025', 'true');
			$rootScope.dialogService.close("userNoticesModal");
		},

		/**
		 * Mostra a janela de release notes
		 */
		showReleaseNotes: function(startedFromMenu) {
			if (startedFromMenu) {
				//Send event to analytics
				if ($rootScope.run_analytics) {
					ga("send", {
						hitType: "event",
						eventCategory: "ReleaseNotes",
						eventAction: "saw_rel_notes_from_menu",
						eventLabel: "Opened Release Notes from Top Map Menu"
					});
				}
			} else {
				//Send event to analytics
				if ($rootScope.run_analytics) {
					ga("send", {
						hitType: "event",
						eventCategory: "ReleaseNotes",
						eventAction: "saw_rel_notes_automatic",
						eventLabel: "Release Notes automatically shown"
					});
				}
			}

			var options = {
				modal: true,
				title: $rootScope.Users.translateText("Novo Update do MAPWISP!"),
				width: "700px",
				height: "auto",
				resizable: true,
			};
			model = [];
			$rootScope.dialogService.open("releaseNotesModal", "releaseNotesModal", model, options).then();
			self.newReleaseNotesAlert = false;

			// Scrolling to top of release notes
			setTimeout(function() {
				var relNotesContentDiv = document.getElementById("rel-notes-content-wrapper");
				relNotesContentDiv.scrollTop = 0;
			}, 100);
		},

		/**
		 * Fires a google analytics event for integraolt actions
		*/
		gaEvent: function(eventAction, lang) {
			//Send event to analytics
			if ($rootScope.run_analytics) {
				ga("send", {
					hitType: "event",
					eventCategory: "IntegraOLT Actions",
					eventAction: eventAction,
					eventLabel: "Manual - " + lang
				});
			}
		},

		goto_element: function(data) {
			//Send event to analytics
			if ($rootScope.run_analytics) {
				ga("send", {
					hitType: "event",
					eventCategory: "TreeView Actions",
					eventAction: "Go To Element - DbClick",
					eventLabel: "Show element on map"
				});
			}

			//category 2 = AP
			if (data.category == 2) {
				var ap = $rootScope.AccessPoints.accessPoints[data.tomo_type_index][data.tomo_index];
				//Centralizar mapa no ap
				var location = new google.maps.LatLng(ap.dot.position.lat(), ap.dot.position.lng());
				self.map.setCenter(location);
				self.map.setZoom(22);
			}
			//category 3 = cable
			if (data.category == 3) {
				var cable = $rootScope.Cables.cables[data.tomo_type_index][data.tomo_index];
				//Centralizar mapa no cabo
				var bounds = new google.maps.LatLngBounds();
				var points = cable.polyline.getPath().getArray();
				for (var n = 0; n < points.length; n++) {
					bounds.extend(points[n]);
				}
				self.map.fitBounds(bounds);
			}
			//category 4 = cliente
			if (data.category == 4) {
				var client = $rootScope.Clients.clients[data.tomo_index];
				//Centralizar mapa no cliente
				var location = new google.maps.LatLng(client.marker.position.lat(), client.marker.position.lng());
				self.map.setCenter(location);
				self.map.setZoom(22);
			}

			//category 5 = poste
			if (data.category == 5) {
				var poste = $rootScope.Posts.posts[data.tomo_index];
				//Centralizar mapa no building
				var location = new google.maps.LatLng(poste.dot.position.lat(), poste.dot.position.lng());
				self.map.setCenter(location);
				self.map.setZoom(22);
			}

			//category 9 = predio
			if (data.category == 9) {
				var building = $rootScope.Buildings.buildings[data.tomo_index];
				//Centralizar mapa no building
				var location = new google.maps.LatLng(building.marker.position.lat(), building.marker.position.lng());
				self.map.setCenter(location);
				self.map.setZoom(22);
			}

		},


		treeView: function() {
			if (self.wide_sidebar) {
				// Change from wide sidebar to narrow sidebar
				$("#jstree-id-width").css("width", "4%");
				$("#conteudo").css("width", "96%");
				$(".jstree-sidebar").css("overflow-x", "hidden");
				$(".jstree-sidebar").css("overflow-y", "hidden");
				self.wide_sidebar = false;
			} else {
				// Change from narrow sidebar to wide sidebar
				$("#jstree-id-width").css("width", "17%");
				$("#conteudo").css("width", "83%");
				$(".jstree-sidebar").css("overflow-x", "scroll");
				$(".jstree-sidebar").css("overflow-y", "scroll");
				self.wide_sidebar = true;
			}
			setTimeout(function() {
				$(window).trigger("resize");
			}, 100);
		},

		clearCacheReload: function() {

			//deletar cache do browser
			caches.keys().then((keyList) => Promise.all(keyList.map((key) => caches.delete(key))));

			for (var i = localStorage.length - 1; i >= 0; --i) {
				var key = localStorage.key(i)
				if (key.startsWith("trd:")) {
					localStorage.removeItem(key)
				}
			};

			//request pra deletar cache do servidor
			$.ajax({
				url: $rootScope.base_url + "/maps/clear_cache_reload",
				type: "POST",
				//async:false,
				success: function() {

					//recarregar mapwisp
					window.location.reload(true);

				},
			});

		},

		/**
		 * Region Reports method
		 * Initiates the region definition, in order to get reports from the region
		 *
		 * */
		regionReports: function() {
			if ($rootScope.region_report_modal_open) {
				$rootScope.message_error = $rootScope.Users.translateText("Feche a janela de relatorio atual para abrir uma nova");
				$timeout(function() {
					$rootScope.message_error = "";
				}, 3000);
				return;
			}
			$rootScope.region_report_modal_open = true;
			var options = {
				autoOpen: false,
				modal: false,
				title: $rootScope.Users.translateText("Relatorios por região"),
				width: 352,
				height: "auto",
				resizable: false,
				dialogClass: "noclose",
				dialogClass: "noclose no-scroll",
				position: {
					my: "right top",
					at: "right-10 top+80",
					of: window,
					collision: "none"
				},
				create: function(event, ui) {
					$(event.target).parent().css("position", "fixed");
				},
				close: function() {
					$rootScope.menuMap = false;
					$rootScope.region_report_modal_open = false;
				}
			};
			model = [];
			self.region_report_inprg = true;
			$rootScope.dotsCount = 0;
			$rootScope.form = [];
			$rootScope.form.error = [];
			dialogService.open("regionReports", "regionReports", model, options).then();
		},

		/**
		 * Region reports cancel
		 * Cancels the region definition for reports, and closes the reports window
		 * */
		regionReportsCancel: function() {
			if ($rootScope.dotsCount > 0) {
				angular.forEach($rootScope.dotsTemp, function(val, index) {
					val.setMap(null);
				});
				$rootScope.shapeTemp.setMap(null);
			}
			$rootScope.tempPath = [];
			$rootScope.dotsTemp = [];
			$rootScope.shapeTemp = [];
			$rootScope.dotsCount = 0;
			$rootScope.form = [];
			$rootScope.form.error = [];
			dialogService.close("regionReports");
			self.region_report_inprg = false;
		},

		fixedRegionReportsCancel: function() {
			dialogService.close("fixedRegionReports");
			self.region_report_inprg = false;
		},


		change_kmz_saving_folder: function() {
			var node = self.folders[$rootScope.form.kmz_folder];
			$rootScope.Nodes.setAsSavingFolder(node);
		},

		/**
		 * Open the KMZ/KML Import and Export Modal
		 * */
		kmzKml: function() {

			$rootScope.Cables.offEditCablePolyline();

			if (!self.jstree_ready) {
				return;
			}

			//Load JSTree Folders
			nodes = $("#jstree-sidebar-div").jstree().get_json("#", { flat: true })
			self.folders = [];
			angular.forEach(nodes, function(node, index_node) {
				if (node.data.category == 1) {
					self.folders.push(node);
				}
			});

			var options = {
				autoOpen: false,
				modal: false,
				title: $rootScope.Users.translateText("Importação de arquivos KML ou PDF"),
				width: 450,
				height: "auto",
				resizable: true,
				position: {
					my: "top",
					at: "top+140",
					of: window,
					collision: "none"
				},
				create: function(event, ui) {
					$(event.target).parent().css("position", "fixed");
					self.uploadComplete = 0;
					// Reset import progress UI state
					self.importProgress = {
						active: false,
						totalChunks: 0,
						doneChunks: 0,
						percent: 0,
						status: ""
					};
				},
				close: function() {
					self.KmzKmlImport = null;
					$rootScope.percentage = 0;
					$rootScope.form.kmz_add_type = "";
					// Reset import progress UI state
					self.importProgress = {
						active: false,
						totalChunks: 0,
						doneChunks: 0,
						percent: 0,
						status: ""
					};
				}
			};
			model = [];
			$rootScope.serialAdd = true;
			$rootScope.dialogService.open("KmzKmlModal", "KmzKmlModal", model, options).then();
		},

		setKmzKmlImport: function() {
			// 1 means import, 2 means export
			self.KmzKmlImport = 1;
		},

		setKmzKmlExport: function() {
			// 1 means import, 2 means export
			self.KmzKmlImport = 2;
		},

		/**
		 * Upload KMZ KML method
		 *
		 * Loads the kmz or kml file to the browser; If it's KMZ, unzips it [TODO].
		 * Having the KML/XML string, calls the parsing function
		 * */
		uploadKmzKml: function(file) {
			console.log("[KML IMPORT] Iniciando uploadKmzKml", file ? file.name : "sem arquivo");
			if (!file) {
				$rootScope.form.error = { file: $rootScope.Users.translateText("Por favor, escolha um arquivo") };
				return;
			}
			var split = file.name.split(".");
			var ext = split[split.length - 1].toLowerCase();
			console.log("[KML IMPORT] Extensão detectada:", ext);

			if (ext == "kmz") {
				console.log("[KML IMPORT] Lendo arquivo KMZ...");
				//IN CASE OF KMZ FILES - UNZIP FIRST
				var zip_reader = new FileReader();
				zip_reader.onloadend = function(e) {
					console.log("[KML IMPORT] KMZ lido, iniciando descompressão");
					$rootScope.percentage = 100;
					if (!$rootScope.$$phase) $rootScope.$apply();
					try {
						var kmlString = self.unzipKmz(e.target.result);
						console.log("[KML IMPORT] KMZ descomprimido, tamanho da string:", kmlString.length);
						self.parseKml(kmlString);
					} catch (err) {
						console.error("[KML IMPORT] Erro ao processar KMZ:", err);
						$rootScope.message_error_modal = "Erro ao processar arquivo KMZ: " + err.message;
						if (!$rootScope.$$phase) $rootScope.$apply();
					}
				}
				var lastProgress = 0;
				zip_reader.onprogress = function(p) {
					var now = Date.now();
					if (now - lastProgress > 200) { // Throttle a cada 200ms
						$rootScope.percentage = (p.loaded / p.total) * 100;
						if (!$rootScope.$$phase) $rootScope.$apply();
						lastProgress = now;
					}
				}
				zip_reader.readAsArrayBuffer(file);
			} else if (ext == "kml") {
				console.log("[KML IMPORT] Lendo arquivo KML...");
				//IN CASE OF KML - READ AS TEXT
				var text_reader = new FileReader();
				text_reader.onloadend = function(e) {
					console.log("[KML IMPORT] KML lido, processando string...");
					$rootScope.percentage = 100;
					if (!$rootScope.$$phase) $rootScope.$apply();
					var kmlString = e.target.result.trim();
					console.log("[KML IMPORT] Tamanho original do KML:", kmlString.length);

					try {
						var startTime = Date.now();
						//Necessário remover os seguintes caracteres para evitar bug
						// Otimizado: substituição global de uma vez se possível, mas mantendo a lógica de <name>
						console.log("[KML IMPORT] Iniciando limpeza de tags <name>...");
						kmlString = kmlString.replace(/<name>(.*?)<\/name>/g, (match, content) => {
							return "<name>" + content.replace(/[<>&]/g, "") + "</name>";
						});
						console.log("[KML IMPORT] Limpeza de <name> concluída em " + (Date.now() - startTime) + "ms");

						startTime = Date.now();
						//Remover tag ExtendedData desnecessária que gera bug
						console.log("[KML IMPORT] Removendo ExtendedData...");
						kmlString = kmlString.replace(/<ExtendedData[\s\S]*?<\/ExtendedData>/g, "");
						console.log("[KML IMPORT] Remoção de ExtendedData concluída em " + (Date.now() - startTime) + "ms");
						
						console.log("[KML IMPORT] String limpa, tamanho final:", kmlString.length);

						self.parseKml(kmlString);
					} catch (err) {
						console.error("[KML IMPORT] Erro ao processar string KML:", err);
						$rootScope.message_error_modal = "Erro ao processar arquivo KML: " + err.message;
						if (!$rootScope.$$phase) $rootScope.$apply();
					}
				}
				var lastProgressKml = 0;
				text_reader.onprogress = function(p) {
					var now = Date.now();
					if (now - lastProgressKml > 200) {
						$rootScope.percentage = (p.loaded / p.total) * 100;
						if (!$rootScope.$$phase) $rootScope.$apply();
						lastProgressKml = now;
					}
				}
				text_reader.readAsText(file);

			} else if (ext == "pdf") {
				console.log("[PDF IMPORT] Iniciando importação de PDF");
				self.arrPosts = [];
				self.arrClients = [];
				self.kmz_points = [];
				self.kmz_lines = [];
				self.points_found = 0;
				self.lines_found = 0;

				//Step 2: Read the file using file reader
				var fileReader = new FileReader();
				fileReader.onload = function() {
					console.log("[PDF IMPORT] fileReader.onload chamado");
					//Step 4: turn array buffer into typed array
					var typedarray = new Uint8Array(this.result);
					console.log("[PDF IMPORT] TypedArray criado, tamanho:", typedarray.length);

					//Step 5: pdfjs should be able to read this
					if (typeof PDFJS === 'undefined') {
						console.error("[PDF IMPORT] ERRO: PDFJS não está definido!");
						$rootScope.message_error_modal = "PDF.js não está carregado. Por favor, recarregue a página.";
						$rootScope.$apply();
						return;
					}
					console.log("[PDF IMPORT] PDFJS encontrado, iniciando getDocument");
					const loadingTask = PDFJS.getDocument(typedarray);
					loadingTask.promise.then(pdf => {
						console.log("[PDF IMPORT] PDF carregado com sucesso, total de páginas:", pdf.numPages);

						let initJ = 0;
						let isClientImport = false;
						$rootScope.form.kmz_add_type = 4;

						// For each page
						for (var i = 1; i <= pdf.numPages; i++) {
							console.log("[PDF IMPORT] Processando página:", i, "de", pdf.numPages);
							try {
								pdf.getPage(i).then(function(pdfPage) {
									console.log("[PDF IMPORT] Página carregada, obtendo textContent...");
									// getTextContent method returns text items in page
									pdfPage.getTextContent().then(function(textContent) {
										console.log("[PDF IMPORT] textContent obtido, total de items:", textContent.items ? textContent.items.length : 0);
										console.log("[PDF IMPORT] Primeiros 10 items:", textContent.items ? textContent.items.slice(0, 10).map(function(item) { return item.str; }) : []);
										// for (item of textContent.items){

										if ((textContent.items[0].str && textContent.items[0].str == "Cliente")) {
											console.log("[PDF IMPORT] Detectado importação de Clientes (header 'Cliente' encontrado)");
											initJ = 3;
											isClientImport = true;
											$rootScope.form.kmz_add_type = 5;
										} else {
											console.log("[PDF IMPORT] Importação de Postes (initJ=" + initJ + ", isClientImport=" + isClientImport + ")");
										}

										var itemsProcessed = 0;
										for (let j = initJ; j < textContent.items.length; isClientImport ? j += 3 : j++) {
											if (textContent.items[j]) {
												let item = textContent.items[j];

												if (isClientImport) {
													var client = {};
													client.dot = {};
													client.name = textContent.items[j].str;
													client.dot.lat = textContent.items[j + 1].str;
													client.dot.lng = textContent.items[j + 2].str;

													self.arrClients[self.arrClients.length] = client;
													itemsProcessed++;
												} else {
													if (item.str &&
														item.str.indexOf(",") &&
														item.str.match("-?[0-9]{1,3}[.][0-9]+")) {

														console.log("[PDF IMPORT] Coordenada detectada! j=" + j + ", item.str='" + item.str + "'");

														var post = {};
														post.dot = {};

														// Detectar se o item contém ID e coordenadas juntos (formato: "ID lat,lng" ou "ID -lat,-lng")
														// Padrão: número (ID) seguido de espaço e coordenadas (pode ter hífen antes do número)
														// Exemplo: "219948033 -25.2731809606621,-50.7300677024393"
														var combinedPattern = /^(\d+)\s+(-?[0-9]{1,3}\.[0-9]+),\s*(-?[0-9]{1,3}\.[0-9]+)$/;
														var match = item.str.trim().match(combinedPattern);

														if (match) {
															// Formato combinado: "ID lat,lng" tudo junto
															console.log("[PDF IMPORT] Formato combinado detectado: ID e coordenadas no mesmo item");
															post.name = match[1];  // ID da concessionária
															post.id_concessionaria = match[1];
															post.dot.lat = match[2];  // latitude
															post.dot.lng = match[3];  // longitude
															console.log("[PDF IMPORT] Post criado com name/id_concessionaria:", post.name);
														} else {
															// Formato separado: coordenadas no item atual, ID no item anterior
															console.log("[PDF IMPORT] Formato separado: procurando ID no item anterior (j-1)");
															console.log("[PDF IMPORT] Item anterior (j-1):", j > 0 && textContent.items[j - 1] ? textContent.items[j - 1].str : "não existe");

															if (j > 0 && textContent.items[j - 1] && textContent.items[j - 1].str) {
																// Verificar se o item anterior é um ID (só números)
																var prevStr = textContent.items[j - 1].str.trim();
																if (/^\d+$/.test(prevStr)) {
																	post.name = prevStr;  // '219948033'
																	post.id_concessionaria = prevStr;  // '219948033'
																	console.log("[PDF IMPORT] Post criado com name/id_concessionaria do item anterior:", post.name);
																} else {
																	post.name = "importado";
																	console.log("[PDF IMPORT] Item anterior não é um ID válido, usando 'importado'");
																}
															} else {
																post.name = "importado";
																console.log("[PDF IMPORT] Item anterior não existe, usando 'importado'");
															}

															// Extrair coordenadas do item atual
															var coords = item.str.split(",");
															if (coords.length >= 2) {
																post.dot.lat = coords[0].trim();
																post.dot.lng = coords[1].trim();
															} else {
																console.error("[PDF IMPORT] Formato de coordenadas inválido:", item.str);
																continue; // Pular este item
															}
														}

														console.log("[PDF IMPORT] Post criado:", JSON.stringify(post));

														self.arrPosts[self.arrPosts.length] = post;
														itemsProcessed++;
													}
												}
											}

										}

										console.log("[PDF IMPORT] Items processados nesta página:", itemsProcessed);

										console.log("[PDF IMPORT] arrPosts após processamento desta página:", self.arrPosts);
										console.log("[PDF IMPORT] Total arrPosts:", self.arrPosts.length, "| Total arrClients:", self.arrClients.length);

										self.points_found = isClientImport ? self.arrClients.length : self.arrPosts.length;
										self.uploadComplete = 2;

										$rootScope.$apply();
									}).catch(function(err) {
										console.error("[PDF IMPORT] ERRO ao obter textContent da página:", err);
										$rootScope.message_error_modal = "Erro ao processar texto do PDF: " + (err.message || err);
										$rootScope.$apply();
									});


								}).catch(function(err) {
									console.error("[PDF IMPORT] ERRO ao carregar página:", err);
									$rootScope.message_error_modal = "Erro ao carregar página do PDF: " + (err.message || err);
									$rootScope.$apply();
								});
							} catch (err) {
								console.error("[PDF IMPORT] ERRO no try/catch da página:", err);
								$rootScope.message_error_modal = "Erro ao processar página do PDF: " + (err.message || err);
								$rootScope.$apply();
							}
						}

						console.log("[PDF IMPORT] Loop de páginas concluído. arrPosts final:", self.arrPosts.length);

					}).catch(function(err) {
						console.error("[PDF IMPORT] ERRO ao carregar documento PDF:", err);
						$rootScope.message_error_modal = "Erro ao carregar PDF: " + (err.message || err);
						$rootScope.$apply();
					});

				};

				fileReader.onprogress = function(p) {
					$rootScope.percentage = (p.loaded / p.total) * 100;
					$rootScope.$apply();
				}

				fileReader.onerror = function(err) {
					console.error("[PDF IMPORT] ERRO ao ler arquivo:", err);
					$rootScope.message_error_modal = "Erro ao ler arquivo PDF";
					$rootScope.$apply();
				}

				//Step 3:Read the file as ArrayBuffer
				console.log("[PDF IMPORT] Iniciando leitura do arquivo como ArrayBuffer");
				fileReader.readAsArrayBuffer(file);

			} else {
				$rootScope.form.error = [];
				$rootScope.form.error.file = $rootScope.Users.translateText("Arquivo deve estar no formato KMZ ou KML");
				$timeout(function() {
					$rootScope.form.error.file = "";
				}, 3000);
			}
		},

		/**
		 * Unzip KMZ method
		 * Unzips a kmz file stored in an array buffer, and returns a string with the kml file
		 * */
		unzipKmz: function(zip_buf) {
			var kmlString = pako.inflate(zip_buf, { to: 'string' });
			return kmlString;
		},

		/**
		 * parse KML method
		 *
		 * given a KML XML string, finds the Points and Lines in that file, and stores them in local variables, in order to process them later;
		 * */
		parseKml: function(kmlString) {
			console.log("[KML IMPORT] parseKml iniciado. Tamanho da string: " + kmlString.length);
			var startTime = Date.now();
			try {
				// Usar DOMParser diretamente para evitar overhead do jQuery no parse inicial
				var parser = new DOMParser();
				var kmlDoc = parser.parseFromString(kmlString, "text/xml");
				
				if (kmlDoc.getElementsByTagName("parsererror").length > 0) {
					console.error("[KML IMPORT] Erro de parser XML detectado");
					throw new Error("Erro de formatação no XML do KML");
				}
				
				console.log("[KML IMPORT] XML parseado com DOMParser em " + (Date.now() - startTime) + "ms");
				startTime = Date.now();

				self.points_found = 0;
				self.lines_found = 0;
				self.kmz_points = [];
				self.kmz_lines = [];

				// Usar getElementsByTagName nativo - muito mais rápido que $.find
				var placemarks = kmlDoc.getElementsByTagName("Placemark");
				console.log("[KML IMPORT] Placemarks encontrados:", placemarks.length);

				// Processar em blocos para não travar a UI e evitar estouro de pilha se xml2json for o culpado
				for (var i = 0; i < placemarks.length; i++) {
					if (i % 1000 === 0 && i > 0) {
						console.log("[KML IMPORT] Processando item " + i + " de " + placemarks.length + "...");
					}
					
					try {
						// Passar o nó nativo para o xml2json
						var json = $.xml2json(placemarks[i]);
						
						if (json.Point) {
							self.points_found++;
							self.kmz_points.push(json);
						} else if (json.LineString) {
							self.lines_found++;
							self.kmz_lines.push(json);
						}
					} catch (e) {
						// Logar apenas o primeiro erro para não inundar o console
						if (i === 0) console.warn("[KML IMPORT] Erro ao processar placemark:", e);
					}
				}

				console.log("[KML IMPORT] Processamento concluído em " + (Date.now() - startTime) + "ms. Pontos:", self.points_found, "Linhas:", self.lines_found);

				var total_pontos = self.points_found + self.lines_found;
				if (total_pontos > 300000) {
					console.warn("[KML IMPORT] Itens excessivos:", total_pontos);
					self.uploadComplete = 3;
				} else {
					self.uploadComplete = 2;
				}
				
				// Garantir que o apply ocorra apenas no final para performance
				if (!$rootScope.$$phase) $rootScope.$apply();
				
			} catch (err) {
				console.error("[KML IMPORT] Erro fatal no parseKml:", err);
				$rootScope.message_error_modal = "Erro ao ler o conteúdo do KML: " + err.message;
				if (!$rootScope.$$phase) $rootScope.$apply();
			}
		},

		/**
		 * Import All Kmz Method
		 *
		 * This method is called after the kml file has been parsed, and the points and lines have been found.
		 * For the points and lines, calls the function that saves them
		 * */
		importAllKmz: function() {
			//Check if there aren't too many items
			if ((self.kmz_points.length + self.kmz_lines.length) > 300000) {
				return;
			}

			//Check if all options are set (type of dots, type of lines)
			if (!$rootScope.form.kmz_folder) {
				self.set_kmz_error($rootScope.Users.translateText("Escolha a pasta para salvar os itens"));
				return;
			}
			if (self.kmz_points.length > 0) {
				if (!$rootScope.form.kmz_add_type) {
					self.set_kmz_error($rootScope.Users.translateText("Escolha como salvar os pontos"));
					return;
				}
				if (($rootScope.form.kmz_add_type == 1) || ($rootScope.form.kmz_add_type == 2) || ($rootScope.form.kmz_add_type == 3)) {
					if ((!$rootScope.form.armario_access_point_type_id) && (!$rootScope.form.emenda_access_point_type_id) && (!$rootScope.form.atend_access_point_type_id)) {
						self.set_kmz_error($rootScope.Users.translateText("Escolha um tipo de ponto de acesso"));
						return;
					}
				}
			}
			if (self.kmz_lines.length > 0) {
				if (!$rootScope.form.kmz_cable_type) {
					self.set_kmz_error($rootScope.Users.translateText("Escolha um tipo de cabo para as linhas"));
					return;
				}
			}

			setTimeout(function() {
				self.KmzKmlImporting = true;
				$rootScope.$apply(); // Force UI update to show spinner

				if (self.kmz_points.length > 0) {
					self.importKmzPoints();
				}
				if (self.kmz_lines.length > 0) {
					self.importKmzLines();
				}
				if (!jQuery.isEmptyObject(self.arrPosts)) {

					link = $rootScope.base_url + "/posts/add_many";
					self.add_many(self.arrPosts, link);

				}
				if (!jQuery.isEmptyObject(self.arrClients)) {

					link = $rootScope.base_url + '/clients/add_many';
					self.add_many(self.arrClients, link);

				}
				//    self.KmzKmlImporting = false;
			}, 0);
		},


		/**
		 * Import Points Method
		 *
		 * This method is called after the kml file has been parsed, and the points and lines have been found.
		 * For the points, calls the function that saves them
		 * */
		importPoints: function() {
			// Verificar se há pontos, posts ou clientes para importar
			var hasPoints = self.kmz_points.length > 0;
			var hasPosts = !jQuery.isEmptyObject(self.arrPosts);
			var hasClients = !jQuery.isEmptyObject(self.arrClients);

			if (hasPoints || hasPosts || hasClients) {
				//Validar se tipos de itens foram preenchidos
				if (!$rootScope.form.kmz_folder) {
					self.set_kmz_error($rootScope.Users.translateText("Escolha a pasta para salvar os itens"));
					return;
				}
				if (hasPoints && !$rootScope.form.kmz_add_type) {
					self.set_kmz_error($rootScope.Users.translateText("Escolha como salvar os pontos"));
					return;
				}
				if (hasPoints && (($rootScope.form.kmz_add_type == 1) || ($rootScope.form.kmz_add_type == 2) || ($rootScope.form.kmz_add_type == 3))) {
					if ((!$rootScope.form.armario_access_point_type_id) && (!$rootScope.form.emenda_access_point_type_id) && (!$rootScope.form.atend_access_point_type_id)) {
						self.set_kmz_error($rootScope.Users.translateText("Escolha um tipo de ponto de acesso"));
						return;
					}
				}
			} else {
				self.set_kmz_error($rootScope.Users.translateText("Não há pontos, posts ou clientes para importar"));
				return;
			}
			setTimeout(function() {
				self.KmzKmlImporting = true;
				$rootScope.$apply(); // Force UI update to show spinner

				if (self.kmz_points.length > 0) {
					self.importKmzPoints();
				}
				if (!jQuery.isEmptyObject(self.arrPosts)) {
					link = $rootScope.base_url + "/posts/add_many";
					self.add_many(self.arrPosts, link);
				}
				if (!jQuery.isEmptyObject(self.arrClients)) {
					link = $rootScope.base_url + '/clients/add_many';
					self.add_many(self.arrClients, link);
				}
				self.KmzKmlImporting = false;
			}, 0);
		},

		/**
		 * Import Lines Method
		 *
		 * This method is called after the kml file has been parsed, and the points and lines have been found.
		 * For the points, calls the function that saves them
		 * */
		importLines: function() {
			//Validar se ha tipo de cabo escolhido
			if (!$rootScope.form.kmz_folder) {
				self.set_kmz_error($rootScope.Users.translateText("Escolha a pasta para salvar os itens"));
				return;
			}
			if (self.kmz_lines.length > 0) {
				if (!$rootScope.form.kmz_cable_type) {
					self.set_kmz_error($rootScope.Users.translateText("Escolha um tipo de cabo para as linhas"));
					return;
				}
			}

			setTimeout(function() {
				self.KmzKmlImporting = true;
				$rootScope.$apply(); // Force UI update to show spinner

				if (self.kmz_lines.length > 0) {
					self.importKmzLines();
				}
				self.KmzKmlImporting = false;
			}, 0);
		},

		verifyProject: function() {
			//        	   if(!$rootScope.Projects.projectSelected){
			//                   $rootScope.message_error = 'Selecione um projeto';
			//                   $timeout(function() {
			//                     $rootScope.message_error = '';
			//                   }, 3000);
			//                   return false;
			//        	   }
			return true;
		},

		set_kmz_error: function(error) {
			$rootScope.kmz_error_message = error;
			$timeout(function() {
				$rootScope.kmz_error_message = null;
			}, 3000);
		},

		/**
		 * Import KMZ Points
		 *
		 * Based on the data given in the modal, plus the saved kmz points information (in JSON), saves each of the points.
		 * */
		importKmzPoints: function() {
			self.isLoading = true;
			$rootScope.message_error_modal = "";
			$rootScope.$apply();
			if (self.kmz_points.length > 0) {
				var arrItems = {};
				angular.forEach(self.kmz_points, function(point, point_index) {

					coordinates = point.Point.coordinates.split(",");

					var item = {};
					item.dot = {};
					item.name = point.name ? point.name : "importado";
					item.dot.lat = coordinates[1];
					item.dot.lng = coordinates[0];

					if ($rootScope.form.kmz_add_type == 1) {

						//ARMARIO
						item.access_point_type_id = $rootScope.form.armario_access_point_type_id;
						item.category = 2;
						item.cost = getCostAp(item.access_point_type_id);

					} else if ($rootScope.form.kmz_add_type == 2) {

						//CX EMENDA
						item.access_point_type_id = $rootScope.form.emenda_access_point_type_id;
						item.category = 4;
						item.cost = getCostAp(item.access_point_type_id);

					} else if ($rootScope.form.kmz_add_type == 3) {

						//CX ATENDIMENTO
						item.access_point_type_id = $rootScope.form.atend_access_point_type_id;
						item.category = 5;
						item.cost = getCostAp(item.access_point_type_id);

					} else if ($rootScope.form.kmz_add_type == 5) {

						//CLIENTES
						//username
						item.username = point.name;
						//password
						item.password = point.name;
						//zabbix_link
						item.zabbix_link = "link.zabbix.com";

					}

					arrItems[point_index] = item;

				});

				if ($rootScope.form.kmz_add_type == 4) {

					link = $rootScope.base_url + "/posts/add_many";
					self.add_many(arrItems, link);

				} else if ($rootScope.form.kmz_add_type == 5) {

					link = $rootScope.base_url + "/clients/add_many";
					self.add_many(arrItems, link);

				} else if ($rootScope.form.kmz_add_type == 9) {

					link = $rootScope.base_url + "/buildings/add_many";
					self.add_many(arrItems, link);

				} else {

					link = $rootScope.base_url + "/access_points/add_many";
					self.add_many(arrItems, link);

				}

			}

			function getCostAp(typeId) {

				return $rootScope.AccessPoints.accessPointTypes.find(t => t.id === parseInt(typeId)).price;

			}

		},

		add_many: function(items, link) {
			var allItems = Object.values(items);
			var total = allItems.length;
			var chunkSize = 1000;
			var chunks = [];

			for (var i = 0; i < total; i += chunkSize) {
				chunks.push(allItems.slice(i, i + chunkSize));
			}

			console.log("[KML IMPORT] Enviando " + total + " itens em " + chunks.length + " blocos...");

			self.isLoading = true;
			self.pendingAddManyRequests += chunks.length;

			// Progress bar state (bound in UI)
			if (!self.importProgress) {
				self.importProgress = { active: false, totalChunks: 0, doneChunks: 0, percent: 0, status: "" };
			}
			self.importProgress.active = true;
			self.importProgress.totalChunks = chunks.length;
			self.importProgress.doneChunks = 0;
			self.importProgress.percent = 0;
			self.importProgress.status = "Enviando 0/" + chunks.length + " blocos...";
			if (!$rootScope.$$phase) $rootScope.$apply();

			// Função recursiva para enviar um bloco por vez (sequencial é mais seguro para o servidor)
			var sendChunk = function(index) {
				if (index >= chunks.length) return;

				var dataSend = JSON.stringify(chunks[index]);
				self.importProgress.status = "Enviando bloco " + (index + 1) + " de " + chunks.length + "...";
				if (!$rootScope.$$phase) $rootScope.$apply();
				$.ajax({
					url: link,
					type: "POST",
					data: {
						data: dataSend,
						saving_node_id: $rootScope.Nodes.saving_node_id
					},
					dataType: "json",
					success: function(data) {
						self.pendingAddManyRequests--;
						console.log("[KML IMPORT] Bloco " + (index + 1) + " de " + chunks.length + " enviado.");
						self.importProgress.doneChunks = self.importProgress.doneChunks + 1;
						self.importProgress.percent = Math.floor((self.importProgress.doneChunks / self.importProgress.totalChunks) * 100);
						self.importProgress.status = "Enviado " + self.importProgress.doneChunks + "/" + self.importProgress.totalChunks + " blocos (" + self.importProgress.percent + "%)";
						if (!$rootScope.$$phase) $rootScope.$apply();

						if (data.status == 1) {
							if (self.pendingAddManyRequests === 0) {
								$rootScope.message_success_modal = "Importação concluída!";
								self.isLoading = false;
								self.importProgress.active = false;
								self.importProgress.status = "Concluído.";
								self.importProgress.percent = 100;
								if (!$rootScope.$$phase) $rootScope.$apply();
								location.reload(true);
							} else {
								// Enviar próximo bloco
								sendChunk(index + 1);
							}
						} else {
							$rootScope.message_error_modal = data.message || "Erro no bloco " + (index + 1);
							self.isLoading = false;
							self.importProgress.active = false;
							self.importProgress.status = "Erro no envio.";
							if (!$rootScope.$$phase) $rootScope.$apply();
						}
					},
					error: function(err) {
						self.pendingAddManyRequests--;
						console.error("[KML IMPORT] Erro fatal no bloco " + (index + 1), err);
						$rootScope.message_error_modal = "Erro de conexão ao enviar bloco " + (index + 1);
						self.isLoading = false;
						self.importProgress.active = false;
						self.importProgress.status = "Erro de conexão.";
						if (!$rootScope.$$phase) $rootScope.$apply();
					}
				});
			};

			// Iniciar primeiro envio
			sendChunk(0);
		},

		/**
		 * Import KMZ Lines
		 *
		 * Based on the data given in the modal, plus the saved kmz lines information (in JSON), saves each of the lines as cables.
		 * */
		importKmzLines: function() {
			self.isLoading = true;
			$rootScope.message_error_modal = "";
			$rootScope.$apply();
			if (self.kmz_lines.length > 0) {

				let arrCables = {};

				angular.forEach(self.kmz_lines, function(line, line_index) {

					let cable = {};
					cable.dots = {};

					//NAME
					cable.name = line.name ? line.name : "importado";

					//COORDINATES=DOTS
					let coords_array = line.LineString.coordinates.split(" ");

					angular.forEach(coords_array, function(coords, index) {

						let array = coords.split(",");
						let coordinate = {
							lat: parseFloat(array[1]),
							lng: parseFloat(array[0])
						};

						cable.dots[index] = coordinate;

					});

					//CABLE TYPE
					cable.cable_type_id = $rootScope.form.kmz_cable_type;

					arrCables[line_index] = cable;
				});

				link = $rootScope.base_url + "/cables/add_many";
				self.add_many(arrCables, link);
			}
		},


		/**
		 * Export a KML File based on the given folder node
		 * New TOMO563: Should consider the current filter set on the TreeView.
		 * @param {*} node
		 * @returns
		 */
		exportKmzKml: function(node) {
			//Send event to analytics
			if ($rootScope.run_analytics) {
				ga("send", {
					hitType: "event",
					eventCategory: "KML",
					eventAction: "Export folder to KML",
					eventLabel: "Export KML"
				});
			}

			self.isLoading = true;
			points_array = [];
			lines_array = [];
			let excluded_nodes = [];
			let unchecked_nodes = [];
			angular.forEach(node.children_d, function(child_node, idx) {
				var icon_color = "#c0c0c0";
				var current_node = $("#jstree-sidebar-div").jstree().get_node(child_node);
				if (!current_node.state.checked) {
					unchecked_nodes.push({ text: current_node.original.text });
					return; // exportar apenas itens selecionados na treeview
				}
				// Levando em consideração se nodo está escondido (propriedade hidden = true), para exportar
				// somente os itens realmente no mapa
				if (current_node.state.hidden) {
					excluded_nodes.push({ text: current_node.original.text });
					return;
				}
				if (current_node.data.category == 2) {
					var ap = $rootScope.AccessPoints.accessPoints[current_node.data.tomo_type_index][current_node.data.tomo_index];
					icon_color = ap.color.length > 1 ? ap.color : "#c0c0c0";
					// Its an access point,
					points_array.push([ap.dot, ap.name, icon_color]);
				} else if (current_node.data.category == 4) {

					var client = $rootScope.Clients.clients[current_node.data.tomo_index];
					// caso o cliente esteja num prédio não terá marker, dai assume o marker do predio
					if (client.apartment_id) {
						var buildingClient = $rootScope.Buildings.buildings.filter(b => b).find(f => f.floors.find(ff => ff.apartments.find(ap => ap.id === client.apartment_id)));
						if (buildingClient) {
							client.marker = buildingClient.marker;
						} else {
							return;
						}
					}
					icon_color = client.color.length > 1 ? client.color : "#c0c0c0";
					// Its a client - Save Point
					points_array.push([client.marker, client.name, icon_color]);
				} else if (current_node.data.category == 5) {
					// Its a post - Save Point
					points_array.push([$rootScope.Posts.posts[current_node.data.tomo_index].dot, $rootScope.Posts.posts[current_node.data.tomo_index].name]);
				} else if (current_node.data.category == 9) {
					var building = $rootScope.Buildings.buildings[current_node.data.tomo_index];
					icon_color = building.color.length > 1 ? building.color : "#c0c0c0";
					// Its a building - Save Point
					points_array.push([building.marker, building.name, icon_color]);
				} else if (current_node.data.category == 3) {
					var cable = $rootScope.Cables.cables[current_node.data.tomo_type_index][current_node.data.tomo_index];
					// Its a cable - Save line
					lines_array.push(cable);

					// get cable reserves
					$rootScope.Reserves.reserves.filter(r => r.cable_id.toString() === cable.id.toString()).forEach(reserve => {
						points_array.push([reserve.dot, reserve.length.toString()]);
					});
				}
			});
			self.createKml(node.text, points_array, lines_array, node.data.tomo_node_id);
			self.isLoading = false;

			// Se alguns itens não foram mostrados por estarem filtrados, mostrar aviso;
			if (excluded_nodes.length > 0 || unchecked_nodes.length > 0) {
				self.alertNodesExcludedFromKmlExport(excluded_nodes, unchecked_nodes);
			}

			return;
		},

		alertNodesExcludedFromKmlExport: function(excluded_nodes, unchecked_nodes) {
			var options = {
				autoOpen: false,
				modal: true,
				title: $rootScope.Users.translateText("Itens omitidos do KML"),
				width: 300,
				height: "auto",
				resizable: true,
				dialogClass: "noclose",
			};
			$rootScope.messageAlert = $rootScope.Users.translateText("Alguns itens foram omitidos do KML por estarem omitidos do mapa pelo filtro da TreeView, ou por não estarem checados.");
			$rootScope.messageAlert += "<br><br>";
			$rootScope.messageAlert += $rootScope.Users.translateText("Quantidade de itens omitidos pelo filtro: ");
			$rootScope.messageAlert += excluded_nodes.length;
			$rootScope.messageAlert += "<br><br>";
			$rootScope.messageAlert += $rootScope.Users.translateText("Quantidade de itens omitidos por não estarem checados: ");
			$rootScope.messageAlert += unchecked_nodes.length;
			model = [];
			$rootScope.dialogService.open("alertModal", "alertModal", model, options).then();
		},

		createKml: function(folder_name, points_array, lines_array, node_id) {
			//--------CREATINH KML TEXT-----------------------------------------
			KmlString = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<kml xmlns=\"http://www.opengis.net/kml/2.2\" xmlns:gx=\"http://www.google.com/kml/ext/2.2\" xmlns:kml=\"http://www.opengis.net/kml/2.2\" xmlns:atom=\"http://www.w3.org/2005/Atom\"><Document>\n";
			//Points
			angular.forEach(points_array, function(point, point_index) {
				KmlString = KmlString + "<Placemark>\n";
				if (!point[1]) {
					point[1] = "mapwisp - elemento sem nome";
				}
				KmlString = KmlString + "\t<name>" + point[1].replace("&", "&amp;") + "</name>\n"; //replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&apos;").
				if (point[2]) {

					// kml aceita cor no formato aabbggrr
					var color = "ff" + point[2].substr(5, 2) + point[2].substr(3, 2) + point[2].substr(1, 2);

					KmlString = KmlString + "\t<Style>\n";
					KmlString = KmlString + "\t<IconStyle>\n";
					KmlString = KmlString + "\t<Icon><href>http://maps.google.com/mapfiles/kml/paddle/wht-blank.png</href></Icon>\n";
					KmlString = KmlString + "\t<color>" + color + "</color>\n";
					KmlString = KmlString + "\t</IconStyle>\n";
					KmlString = KmlString + "\t</Style>\n";
				}
				KmlString = KmlString + "\t<Point><coordinates>" + point[0].position.lng() + "," + point[0].position.lat() + ",0</coordinates></Point>\n";
				KmlString = KmlString + "</Placemark>\n";
			});
			//Lines
			angular.forEach(lines_array, function(line, line_index) {

				var color = "ff" + line.polyline.strokeColor.substr(5, 2) + line.polyline.strokeColor.substr(3, 2) + line.polyline.strokeColor.substr(1, 2);

				KmlString = KmlString + "<Placemark>\n";
				KmlString = KmlString + "\t<name>" + line.name + "</name>\n";
				KmlString = KmlString + "\t<LineString><coordinates>";
				angular.forEach(line.dots, function(dot, index_dot) {
					KmlString = KmlString + dot.position.lng() + "," + dot.position.lat() + ",0 ";
				});
				KmlString = KmlString + "</coordinates></LineString>\n";
				//Lines Width
				KmlString = KmlString + "<Style><LineStyle><width>6</width>";
				KmlString = KmlString + "\t<color>" + color + "</color></LineStyle></Style>\n";
				KmlString = KmlString + "</Placemark>\n";
			});
			KmlString = KmlString + "</Document></kml>";
			//------------------------------------------------------------------
			//--------CREATING THE FILENAME-------------------------------------
			fileName = "MAPWISP - " + folder_name;
			fileName = fileName + ".kml";
			//--------CREATING DOWNLOAD FILE-------------------------------------
			var blob = new Blob([KmlString], { type: "text/xml;charset=utf-8;" });
			var downloadLink = angular.element("<a></a>");
			downloadLink.attr("href", window.URL.createObjectURL(blob));
			downloadLink.attr("download", fileName);
			document.body.appendChild(downloadLink[0]);
			downloadLink[0].click();
			document.body.removeChild(downloadLink[0]);
			//-------------------------------------------------------------------
			//--------LOG KML GENERATION------------------------------------------
			if (node_id) {
				$.ajax({
					url: $rootScope.base_url + "/maps/log_kml_generation",
					type: "POST",
					data: { folder_name: folder_name, node_id: node_id },
					async: true,
					success: function(data) {
						// Log registrado com sucesso (não precisa fazer nada)
					},
					error: function(data) {
						// Erro ao registrar log (não bloqueia o fluxo)
					}
				});
			}
			//-------------------------------------------------------------------
		},

		/**
		 * Toggle Menu Bar method
		 * Opens the right menu bar (intended for small screens), and closes all the others.
		 * */
		toggleMenuBar: function(id) {
			if (id == 1) {
				if (self.showViewItemsMenu) {
					self.showViewItemsMenu = false;
				} else {
					self.showAddItemsMenu = false;
					self.showDropdownItemsMenu = false;
					self.showViewItemsMenu = true;
				}
			} else if (id == 2) {
				if (self.showAddItemsMenu) {
					self.showAddItemsMenu = false;
				} else {
					self.showViewItemsMenu = false;
					self.showDropdownItemsMenu = false;
					self.showAddItemsMenu = true;
				}
			} else if (id == 3) {
				if (self.showDropdownItemsMenu) {
					self.showDropdownItemsMenu = false;
				} else {
					self.showViewItemsMenu = false;
					self.showAddItemsMenu = false;
					self.showDropdownItemsMenu = true;
				}
			}
		},

		/**
		 * Update Cable Length method
		 * in an interval of 2 minutes, updates the cable length in the database.
		 * */
		updateCableLength: function(start) {
			if (start) {
				//Update the cable length once, and then create the intervar funciton
				$.ajax({
					url: $rootScope.base_url + "/cables/update_cable_length",
					type: "POST",
					success: function(data) {

					}
				});

				//                   self.updateCableLength = $interval(function() {
				//                	   $.ajax({
				//	                   		url: $rootScope.base_url+'/cables/update_cable_length',
				//	                   		type: 'POST',
				//	                   		success:function(data){
				//
				//	                   		}
				//                	   });
				//                   }, 600000);
			} else {
				$interval.cancel(self.updateCableLength);
				console.log("stop update CL");
			}
		},


		/**
		 * Signal Reload Interval
		 *
		 * If parameter "start" is true, starts an interval to reload ONUs signals.
		 * Interval duration is set according to default value "research_interval". If value is not present,
		 * default value is set to 5 (minutes).
		 * @param {} start
		 */
		signalReloadInterval: function(start) {
			if (start) {
				console.log("START INTERVAL");
				// Initialize interval value at 0
				var interval_minutes = 0;

				// If there is a default value, use that value. If there isn't, create new default value of 5
				if ($rootScope.DefaultValues.research_interval) {
					interval_minutes = $rootScope.DefaultValues.research_interval;
				} else {
					interval_minutes = 5;
					dataSend = { name: "research_interval", value: interval_minutes };
					$.ajax({
						url: $rootScope.base_url + "/default_values/add",
						data: dataSend,
						type: "POST",
						success: function(data_return) {/*no action on success - fire and forget*/ },
					});
				}

				// Set interval
				var interval_millis = interval_minutes * 60 * 1000;
				$rootScope.clientSignalReloadInterval = $interval(function() {
					$rootScope.Clients.reloadClientSignal();
				}, interval_millis);
			} else {
				// Cancel interval if user is not in monitor mode
				$interval.cancel($rootScope.clientSignalReloadInterval);
			}
		},

		viewExportRightClick: function(event) {
			if ($rootScope.menuMap) {
				$rootScope.menuMap = false;
				$rootScope.dialogService.close("menuMap");
			}

			if ($rootScope.menuMapViewExport) {
				$rootScope.menuMapViewExport = false;
				$rootScope.dialogService.close("menuMapViewExport");
			}

			if (!$rootScope.Regions.adding && !$rootScope.Cables.adding && !$rootScope.Ruler.started) {
				$rootScope.menuMapViewExport = true;
				$rootScope.event = event;

				//If the sidebar for the TreeView is open, count that in the left offset too.
				if ($rootScope.treeview == true) {
					div_width = $("#jstree-sidebar-div").width();
					left_offset = event.pixel.x + div_width;
				} else {
					left_offset = event.pixel.x;
				}
				$rootScope.dialogService.open("menuMapViewExport", "menuMapViewExport", [], {
					autoOpen: false,
					modal: false,
					width: 230,
					height: 75,
					resizable: true,
					dialogClass: "no-header no-scroll",
					position: {
						my: "left top",
						at: "left+" + left_offset + " top+" + (event.pixel.y + 73),
						of: window,
						collision: "none"
					},
					create: function(event, ui) {
						$(event.target).parent().css("position", "fixed");
					},
					close: function() {
						$rootScope.menuMap = false;
					}
				}).then();
			}
		},

		rightClick: function(event) {
			if ($rootScope.Regions.adding || $rootScope.Cables.adding || $rootScope.Ruler.started) {
				return;
			}

			if ($rootScope.Cables.adding || $rootScope.Regions.adding || $rootScope.Regions.editing) {
				$rootScope.message_error = $rootScope.Users.translateText("Finalize ou cancele o cadastro/edição");
				$timeout(function() {
					$rootScope.message_error = "";
				}, 7000);
				$rootScope.$digest();
			} else {

				if ($rootScope.menuMap) {
					$rootScope.menuMap = false;
					$rootScope.dialogService.close("menuMap");
				}

				//If the sidebar for the TreeView is open, count that in the left offset too.
				if ($rootScope.treeview == true) {
					div_width = $("#jstree-sidebar-div").width();
					left_offset = event.pixel.x + div_width;
				} else {
					left_offset = event.pixel.x;
				}
				var options = {
					autoOpen: false,
					modal: false,
					width: 230,
					height: 75,
					resizable: true,
					dialogClass: "no-header no-scroll",
					position: {
						my: "left top",
						at: "left+" + left_offset + " top+" + (event.pixel.y + 73),
						of: window,
						collision: "none"
					},
					create: function(event, ui) {
						$(event.target).parent().css("position", "fixed");
					},
					close: function() {
						$rootScope.menuMap = false;
					}
				};
				model = [];
				$rootScope.menuMap = true;
				$rootScope.event = event;

				if (!$rootScope.Regions.adding && !$rootScope.Cables.adding && !$rootScope.Ruler.started) {
					$rootScope.dialogService.open("menuMap", "menuMap", model, options).then();
				}


			}
		},


		click: function(event) {
			$rootScope.current_position = [];
			$rootScope.current_position.lat = event.latLng.lat();
			$rootScope.current_position.lng = event.latLng.lng();

			if ($rootScope.Cables.editing) {
				$rootScope.Cables.offEditCablePolyline();
			} else if ($rootScope.Regions.adding || self.region_report_inprg) {
				self.regionHelper(event);
			} else if ($rootScope.Cables.adding) {
				self.cableHelper(event, 1, false, false);
			} else if ($rootScope.Ruler.started) {
				self.rulerHelper(event);
				return;
			}

			if (self.serialAdding) {
				self.addSerialItem();
			}

			$rootScope.$digest();
		},


		setCenter: function(lat, lng, zoom) {
			//if (zoom < 15) zoom = 15;
			latLng = new google.maps.LatLng(lat, lng);
			self.map.setOptions({
				zoom: zoom,
				center: latLng,
			});
		},

		//   /**
		//    * show Markers method
		//    * This method is called every time the bounds of the map change (map moved).
		//    * This responds to changes dragging the map, or by zoom changes.
		//    *
		//    * */
		//   showMarkers : function(){
		// 	  if ($rootScope.Nodes.isLoading){
		// 		  return;
		// 	  }
		// 	  var bounds = self.map.getBounds();
		// 	  selected = $("#jstree-sidebar-div").jstree().get_checked ([true])

		// 	  angular.forEach(selected, function(node, index_node){
		// 		  if (node.data.category == 2){
		// 			  //Its an access point
		// 			  self.showItemMarker(bounds, $rootScope.AccessPoints.accessPoints[node.data.tomo_type_index][node.data.tomo_index].dot);
		// 		  } else if (node.data.category == 3){
		// 			  //Its a cable
		// 			  self.showCablePolyline(bounds, $rootScope.Cables.cables[node.data.tomo_type_index][node.data.tomo_index]);
		// 		  } else if (node.data.category == 4){
		// 			  //Its client
		// 			  self.showItemMarker(bounds, $rootScope.Clients.clients[node.data.tomo_index].marker);
		// 			  //also show/hide the drop cable related to id, if its there
		// 			  if (node.data.drop_type_index){
		// 				  self.showCablePolyline(bounds, $rootScope.Cables.cables[node.data.drop_type_index][node.data.drop_index]);
		// 			  }
		// 		  }
		// 	  });

		// 	  //Posts
		// 	  //Notes
		//   },

		//   showItemMarker : function(bounds, item){
		//     console.log("Show Item Marker");
		// 	  if ((bounds.contains(item.position)) && (self.map.getZoom() > 9)) {
		// 		  //If the item isn't already being displayed
		// 		  if (item.map!=self.map){
		// 			  $rootScope.Markers.addToMap(item);
		// 		  }
		// 	  } else {
		// 		  $rootScope.Markers.removeFromMap(item);
		// 	  }
		//   },

		//   showCablePolyline : function(bounds, cable){
		// 	  var contains = false;
		// 	  if (self.map.getZoom() > 9){
		//     	  var i;
		//     	  for (i = 0; i < cable.dots.length; i++){
		//     		  if (bounds.contains(cable.dots[i].position)){
		//     			  contains = true;
		//     			  break;
		//     		  }
		//     	  }
		// 	  }
		// 	  if (contains){
		// 		  if (cable.polyline.map != self.map){
		// 			  cable.polyline.setMap(self.map);
		// 			  $rootScope.Reserves.setCableReservesMap(cable.id, self.map);
		// 		  }
		// 	  } else {
		// 		  cable.polyline.setMap(null);
		// 		  $rootScope.Reserves.setCableReservesMap(cable.id, null);
		// 	  }
		//   },

		///////////////////////////////////////////////////////////////// HERLPERS ///////////////////////////////////////////////////////////////
		validateProject: function(project, notapply) {
			//                if(project != $rootScope.Projects.projectSelected){
			//                    //encontrar o nome do projeto e setar o erro
			//                	Projects.select(project);
			//                    angular.forEach($rootScope.Projects.projects,function(el,index){
			//                         if(el.id == project){
			//                              $rootScope.message_success = 'Projeto \"'+el.name+'\" selecionado.';
			//                              $timeout(function() {
			//                                   $rootScope.message_success = '';
			//                              }, 3000);
			//                         }
			//                    });
			//                    //if(!notapply){
			//                        $rootScope.$apply();
			//                    //}
			//                    return true;
			//               }else{
			//                    return true;
			//               }
			return true;
		},

		/*
		 * cable Helper function
		 *
		 * event: map event
		 * tipo: 1->mapa, 2->accessPoint, 3->postes, 4->clientes
		 * id: dot_id
		 * category: 1-5 -> AccessPoints; category 6 -> client
		 *
		 * */
		cableHelper: function(event, type, id, category, pon) {
			finalizar = false;
			utp = false;
			fibra = false;
			elementsCategory = false;
			add = true;

			if ($rootScope.dotsCount == 0) {
				$rootScope.tempPath = [];
				$rootScope.dotsTemp = [];
				$rootScope.cableTemp = [];

				newDot = new google.maps.LatLng(event.latLng.lat(), event.latLng.lng());
				$rootScope.tempPath.push(newDot);

				$rootScope.cableTemp = self.drawPolyline($rootScope.tempPath, "Cabo temporário", "#000");
				$rootScope.cableTemp.setMap(self.map);
			} else {
				$rootScope.Cables.cableTypesCad = [];
				//apenas nos casos de caixas de emenda, atendimento e pacs
				if (category != 1 && category != 2 && category != 6) {
					if (!$rootScope.finalizar) {

						//verificar todos os pontos e ver se ja tem caixas de emenda ou de atendimento,se tiver um na rota , nao pode ter o outro
						angular.forEach($rootScope.dotsTemp, function(el, index) {
							if (el.category) {
								if (el.category != 1 && el.category != 2) {
									elementsCategory = el.category;
								}
							}
						});

						if (elementsCategory) {
							// Nao proibindo esse primeiro caso por enquanto.
							// Entao, se comecar o cabo em alguma PAC, pode continuar pra uma caixa de fibra.
							// De qualquer forma, dentro das caixas eh feito o controle de quais cabos podem conectar no que.
							//if((elementsCategory == 3 && (category == 4 || category == 5))){
							//     $rootScope.message_error = 'Voce pode adicionar apenas pacs nesta rota';
							//     add = false;
							//} else
							if ((elementsCategory == 4 || elementsCategory == 5) && (category == 3) && (!pon)) {
								$rootScope.message_error = $rootScope.Users.translateText("Voce pode adicionar apenas caixas de emenda e de atendimento, e PACPON nesta rota");
								add = false;
							}
						}

						if (add) {
							newDot = new google.maps.LatLng(event.latLng.lat(), event.latLng.lng());
							$rootScope.tempPath.push(newDot);
							$rootScope.cableTemp.setPath($rootScope.tempPath);
						}
					}
				} else {
					//apenas nos casos de clientes, fontes e armarios... vai obrigar a finalização do cabo
					if (!$rootScope.finalizar) {
						$rootScope.finalizar = true;
						newDot = new google.maps.LatLng(event.latLng.lat(), event.latLng.lng());
						$rootScope.tempPath.push(newDot);
						$rootScope.cableTemp.setPath($rootScope.tempPath);

						$rootScope.metersCount = self.calculateLengthObject($rootScope.tempPath);
						dot = self.drawMarker(event.latLng.lat(), event.latLng.lng(), "", "marker.png", "Guia", "");
						//tipo : 1->mapa, 2->accessPoint, 3->postes, 4->clientes
						if (id) {
							dot.id = id;
							dot.category = category;
						}
						dot.type = type;
						dot.setMap(self.map);

						$rootScope.dotsTemp.push(dot);
						$rootScope.dotsCount++;
					}
				}
			}



			//apenas filtrando os tipos de cabo para deixar apenas os que se enquadram ao tipo de equipamento (aps) que serao usadas na rota
			angular.forEach($rootScope.Cables.cableTypes, function(el, index) {
				if (elementsCategory == 4 || elementsCategory == 5) {
					$rootScope.Cables.cableTypesAdd = $rootScope.Cables.cableTypes[1];
				}
				if (elementsCategory == 3) {
					$rootScope.Cables.cableTypesAdd = $rootScope.Cables.cableTypes[2];
				}
				$rootScope.$apply();
			});

			if (!$rootScope.finalizar) {
				//caso esteja liberado para adicionar, ele faz a conta do tamanho e adiciona o ponto no cabo
				if (add) {
					$rootScope.metersCount = self.calculateLengthObject($rootScope.tempPath);
					dot = self.drawMarker(event.latLng.lat(), event.latLng.lng(), "", "marker.png", "Guia", "");
					// tipo : 1->mapa , 2->accessPoint ,3 ->poste
					if (id) {
						dot.id = id;
						if (type == 1 || type == 2) {
							dot.category = category;
						}
					}
					dot.type = type;
					dot.setMap(self.map);

					$rootScope.dotsTemp.push(dot);
					$rootScope.dotsCount++;
				}
			} else {
				// apos clicado em um armario ou fonte é obrigatorio encerrar o cabo ou entao remover o ultimo
				$rootScope.message_error = $rootScope.Users.translateText("Você deve finalizar a rota ou remover o ultimo ponto para continuar");
				$rootScope.$digest();
			}

			$timeout(function() { $rootScope.message_error = ""; }, 5000);
			$rootScope.$digest();
		},



		regionHelper: function(event) {
			if ($rootScope.dotsCount == 0) {
				$rootScope.tempPath = [];
				$rootScope.dotsTemp = [];
				$rootScope.shapeTemp = [];

				newDot = new google.maps.LatLng(event.latLng.lat(), event.latLng.lng());
				$rootScope.tempPath.push(newDot);

				$rootScope.shapeTemp = self.drawShape($rootScope.tempPath, "#000");
				$rootScope.shapeTemp.setMap(self.map);

			} else {
				newDot = new google.maps.LatLng(event.latLng.lat(), event.latLng.lng());
				$rootScope.tempPath.push(newDot);

				$rootScope.shapeTemp.setPath($rootScope.tempPath);
			}

			dot = self.drawMarker(event.latLng.lat(), event.latLng.lng(), "", "marker.png", "Guia", "");
			dot.setMap(self.map);
			$rootScope.dotsTemp.push(dot);
			$rootScope.dotsCount++;
		},

		rulerHelper: function(event) {

			if ($rootScope.dotsCount == 0) {

				$rootScope.tempPath = [];
				$rootScope.dotsTemp = [];
				$rootScope.cableTemp = [];

				dot = self.drawMarker(event.latLng.lat(), event.latLng.lng(), "", "marker.png", "Guia régua", "");
				dot.setMap(self.map);
				$rootScope.dotsTemp.push(dot);

				newDot = new google.maps.LatLng(event.latLng.lat(), event.latLng.lng());
				$rootScope.tempPath.push(newDot);

				$rootScope.cableTemp = self.drawPolyline($rootScope.tempPath, "Régua", "#000000");
				$rootScope.cableTemp.setMap(self.map);
				$rootScope.dotsCount++;

			} else {
				dot = self.drawMarker(event.latLng.lat(), event.latLng.lng(), "", "marker.png", "Guia régua", "");
				dot.setMap(self.map);
				$rootScope.dotsTemp.push(dot);

				newDot = new google.maps.LatLng(event.latLng.lat(), event.latLng.lng());
				$rootScope.tempPath.push(newDot);
				$rootScope.cableTemp.setPath($rootScope.tempPath);

				$rootScope.metersCount = self.calculateLengthObject($rootScope.tempPath);
				dot = self.drawMarker(event.latLng.lat(), event.latLng.lng(), "", "marker.png", "Guia", "");

				$rootScope.dotsCount++;
			}

			$rootScope.$digest();
		},


		///////////////////////////////////////////////////////////////// LISTENERS //////////////////////////////////////////////////////////////
		addListenerPost: function(post) {
			google.maps.event.addListener(post.dot, "click", function(event) {
				if ($rootScope.Cables.adding) {
					self.cableHelper(event, 3, post.dot.id, 0);
				} else if ($rootScope.Ruler.started) {
					self.rulerHelper(event);
					return;
				} else {
					// alert('Poste de estrutura');
					var options = {
						autoOpen: false,
						modal: true,
						title: "Atenção",
						width: 300,
						height: "auto",
						resizable: true,
						dialogClass: "noclose alertModal",
					};
					$rootScope.messageAlert = "<span>" + $rootScope.Users.translateText("Nome") + ": " + post.name +
						"</span> <br><span>" + $rootScope.Users.translateText("Proprietário") + ": " + post.owner +
						"</span> <br><span>" + $rootScope.Users.translateText("ID Próprio") + ": " + post.identifier +
						"</span><br><span>" + $rootScope.Users.translateText("ID Concessionária") + ": " + post.id_concessionaria +
						"</span><br><span>" + $rootScope.Users.translateText("Grupo") + ": " + post.group_identifier +
						"</span><br> <span>" + $rootScope.Users.translateText("Valor Aluguel Mensal") + ":" + post.price_month + "</span>";
					model = [];
					$rootScope.dialogService.open("alertModal", "alertModal", model, options).then();
				}
			});

			google.maps.event.addListener(post.dot, "dragend", function(event) {

				// Impede adicionar ao cabo ao arratar item em cima de um ponto
				self.tempRecentDraggedDot = true;

				// Definir um timer para alterar para false após 2 segundos
				setTimeout(function() {
					self.tempRecentDraggedDot = false;
				}, 2000);

				data = {};
				data.id = post.id;
				data.dot = {};
				data.dot.id = post.dot.id;
				data.dot.lat = event.latLng.lat();
				data.dot.lng = event.latLng.lng();

				//verificar se o ponto da reserva tambem é um ponto de um cabo
				angular.forEach($rootScope.Cables.cables, function(cables, index) {
					angular.forEach(cables, function(cable, index) {
						angular.forEach(cable.dots, function(dot, index) {
							if (dot.id == post.dot.id) {
								dot.setPosition(event.latLng);
								dot.setMap(null);
								//isso acima dispara uma função 'position_changed' do ponto do cabo e faz ele atualizar o desenho sozinho
								// Garantir que comprimento do cabo seja atualizado, mandando evento dragend para
								// ponto do cabo
								google.maps.event.trigger(dot, "dragend", event);
							}
						});
					});
				});


				$.ajax({
					url: $rootScope.base_url + "/posts/edit",
					type: "POST",
					data: data,
					success: function(data) {
						if (data.status == 0) {
							$rootScope.set_message(data);
						}
					},
				})
			});

			google.maps.event.addListener(post.dot, "drag", function(event) {
				//verificar se o ponto do poste tambem é um ponto de um cabo
				angular.forEach($rootScope.Cables.cables, function(cables, indexType) {
					angular.forEach(cables, function(cable, cableIndex) {
						angular.forEach(cable.dots, function(dot, index) {
							if (dot.id == post.dot.id) {
								dot.setPosition(event.latLng);
								dot.setMap(self.map);
								// atualizar linha do cabo em tempo real
								path = $rootScope.Cables.cables[indexType][cableIndex].polyline.getPath().getArray();
								pos = new google.maps.LatLng(event.latLng.lat(), event.latLng.lng());//{lat:event.latLng.lat(),lng:event.latLng.lng()};
								path[index] = pos;
								$rootScope.Cables.cables[indexType][cableIndex].polyline.setPath(path);
							}
						});
					});
				});
			});

			google.maps.event.addListener(post.dot, "mousedown", function(event) {
				$rootScope.Cables.offEditCablePolyline();
				if ((LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) ||
					LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR])) && ((!post.deploy_information.deployed))) {
					post.dot.setDraggable(true);
				} else {
					post.dot.setDraggable(false);
				}
				if (post.sharedDatabase) {
					post.dot.setDraggable(false);
				}
			});

			google.maps.event.addListener(post.dot, "rightclick", function(event) {
				//Do nothing if the user is level 4 ("Comercial")
				if (LevelsAndModes.isMode([LevelsAndModes.modes.MODO_COMERCIAL])) {
					return;
				}

				if (post.sharedDatabase) {
					return;
				}

				//   if ($rootScope.Users.current_user.level == 4){
				//       return;
				//   }
				if (LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) ||
					LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR])) {
					var options = {
						autoOpen: false,
						modal: true,
						width: "auto",
						height: 50,
						resizable: true,
						dialogClass: "noclose noheader",
						position: {
							my: "left top",
							at: "left+" + $rootScope.mouse.mouseX + " top+" + $rootScope.mouse.mouseY,
							of: window,
							collision: "none"
						},
						create: function(event, ui) {
							$(event.target).parent().css("position", "fixed");
						},
						close: function() {
							$rootScope.menuPost = false;
						}
					};
					model = [];
					$rootScope.Posts.selectedPost = post;
					$rootScope.Posts.menuPost = false;
					dialogService.open("menuPost", "menuPost", model, options).then();
				} else {
					$rootScope.Posts.selectedPost = false;
				}

			});
		},


		addListenerReserve: function(reserve) {
			google.maps.event.addListener(reserve.dot, "click", function(event) {
				if ($rootScope.Ruler.started) {
					self.rulerHelper(event);
					return;
				}
				$timeout(function() {
					if (!$rootScope.Reserves.visualizing) {
						var options = {
							autoOpen: false,
							modal: true,
							title: "Reserva de cabo",
							width: 300,
							height: "auto",
							resizable: true,
							dialogClass: "noclose",
						};
						$rootScope.messageAlert = "<h6>" + reserve.length + " metros</h6>"
						model = [];
						$rootScope.dialogService.open("alertModal", "alertModal", model, options).then();
					}
				}, 500);

			});
			google.maps.event.addListener(reserve.dot, "dblclick", function(event) {
				//Do nothing if the user is level 4 ("Comercial")
				if (LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_COMERCIAL])) {
					return;
				}
				$rootScope.Reserves.visualizing = true;
				$rootScope.Reserves.edit(reserve);
			});

			google.maps.event.addListener(reserve.dot, "rightclick", function(event) {
				//Do nothing if the user is level 4 ("Comercial")
				if (LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_COMERCIAL])) {
					return;
				}

				if (reserve.sharedDatabase) {
					return;
				}

				if (LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) ||
					LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR])) {
					var options = {
						autoOpen: false,
						modal: true,
						width: "auto",
						height: 50,
						resizable: true,
						dialogClass: "noclose noheader",
						position: {
							my: "left top",
							at: "left+" + $rootScope.mouse.mouseX + " top+" + $rootScope.mouse.mouseY,
							of: window,
							collision: "none"
						},
						create: function(event, ui) {
							$(event.target).parent().css("position", "fixed");
						},
						close: function() {
							$rootScope.menuReserve = false;
						}
					};
					model = [];
					$rootScope.Reserves.selectedReserve = reserve;
					$rootScope.Reserves.menuReserve = false;
					dialogService.open("menuReserve", "menuReserve", model, options).then();
				}

			});


			google.maps.event.addListener(reserve.dot, "dragend", function(event) {

				// Impede adicionar ao cabo ao arratar item em cima de um ponto
				self.tempRecentDraggedDot = true;

				// Definir um timer para alterar para false após 2 segundos
				setTimeout(function() {
					self.tempRecentDraggedDot = false;
				}, 2000);

				data = {};
				data.id = reserve.id;
				data.dot = {};
				data.dot.id = reserve.dot.id;
				data.dot.lat = event.latLng.lat();
				data.dot.lng = event.latLng.lng();

				//verificar se o ponto da reserva tambem é um ponto de um cabo
				angular.forEach($rootScope.Cables.cables, function(cables, index) {
					angular.forEach(cables, function(cable, index) {
						angular.forEach(cable.dots, function(dot, index) {
							if (dot.id == reserve.dot.id) {
								dot.setPosition(event.latLng);
								dot.setMap(null);
								//isso acima dispara uma função 'position_changed' do ponto do cabo e faz ele atualizar o desenho sozinho
								// Garantir que comprimento do cabo seja atualizado, mandando evento dragend para
								// ponto do cabo
								google.maps.event.trigger(dot, "dragend", event);
							}
						});
					});
				});


				$.ajax({
					url: $rootScope.base_url + "/cable_reserves/edit",
					type: "POST",
					data: data,
					success: function(data) {
						if (data.status == 0) {
							$rootScope.set_message(data);
						}
					},
				})
			});

			google.maps.event.addListener(reserve.dot, "drag", function(event) {
				//verificar se o ponto da reserva tambem é um ponto de um cabo
				angular.forEach($rootScope.Cables.cables, function(cables, indexType) {
					angular.forEach(cables, function(cable, cableIndex) {
						angular.forEach(cable.dots, function(dot, index) {
							if (dot.id == reserve.dot.id) {
								dot.setPosition(event.latLng);
								dot.setMap(self.map);
								// atualizar linha do cabo em tempo real
								path = $rootScope.Cables.cables[indexType][cableIndex].polyline.getPath().getArray();
								pos = new google.maps.LatLng(event.latLng.lat(), event.latLng.lng());//{lat:event.latLng.lat(),lng:event.latLng.lng()};
								path[index] = pos;
								$rootScope.Cables.cables[indexType][cableIndex].polyline.setPath(path);
							}
						});
					});
				});
			});

			google.maps.event.addListener(reserve.dot, "mousedown", function(event) {
				$rootScope.Cables.offEditCablePolyline();
				if ((LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) ||
					LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR]))
					&& ((!reserve.deploy_information.deployed))) {
					reserve.dot.setDraggable(true);
				} else {
					reserve.dot.setDraggable(false);
				}
				if (reserve.sharedDatabase) {
					reserve.dot.setDraggable(false);
				}
			});
		},

		getEventAltShift: function(event) {
			return_array = null;
			//angular.forEach(event, function(variable, var_index){
			if (event) {
				if ("altKey" in event) {
					return_array = [];
					return_array.altKey = event.altKey;
					return_array.shiftKey = event.shiftKey;
				}
			}
			//});
			return return_array;
		},

		addListenerAccessPoint: function(accessPoint) {

			google.maps.event.addListener(accessPoint.dot, "click", function(event) {
				if (self.preventApDblclick) {
					return;
				}
				//Dont do anything if a region selection is in progress
				if ($rootScope.Regions.adding || self.region_report_inprg) {
					return;
				}
				//Do nothing if the user is level 4 ("Comercial")
				if ((LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_COMERCIAL]))) {
					if ($rootScope.Clients.connecting_client) {
						$rootScope.Connections.connectClient($rootScope.Clients.clientBlinking, accessPoint);
					}
					return;
				}

				if ($rootScope.Cables.adding) {
					if (!$rootScope.Cables.adding_cordoalha) {
						self.cableHelper(event, 2, accessPoint.dot.id, accessPoint.category, accessPoint.pon);
					}
				} else if ($rootScope.Ruler.started) {
					self.rulerHelper(event);
					return;
				} else if ($rootScope.Clients.connecting_client) {
					$rootScope.Connections.connectClient($rootScope.Clients.clientBlinking, accessPoint);
				} else {
					event_data = self.getEventAltShift(window.event);
					if (event_data) {
						if (event_data.altKey || event_data.shiftKey) {
							$rootScope.Fusions.reloadRoutes = true;
						}
					}
					self.preventApDblclick = true;
					$rootScope.Connections.openAccessPoint(accessPoint);
					setTimeout(() => {
						self.preventApDblclick = false;
					}, 550);
				}
			});

			google.maps.event.addListener(accessPoint.dot, "dblclick", function(event) {
				if (self.preventApDblclick) {
					return;
				}
				//Dont do anything if a region selection is in progress
				if ($rootScope.Regions.adding || self.region_report_inprg) {
					return;
				}
				//Do nothing if the user is level 4 ("Comercial")
				if (LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_COMERCIAL])) {
					return;
				}

				if ($rootScope.Cables.adding) {
					if (!$rootScope.Cables.adding_cordoalha) {
						self.cableHelper(event, 2, accessPoint.dot.id, accessPoint.category);
					}
				} else if ($rootScope.Ruler.started) {
					self.rulerHelper(event);
					return;
				} else if ($rootScope.Clients.connecting_client) {
					$rootScope.Connections.connectClient($rootScope.Clients.clientBlinking, accessPoint);
				} else {
					event_data = self.getEventAltShift(window.event);
					if (event_data) {
						if (event_data.altKey || event_data.shiftKey) {
							$rootScope.Fusions.reloadRoutes = true;
						}
					}
					$rootScope.Connections.openAccessPoint(accessPoint);
				}
			});

			google.maps.event.addListener(accessPoint.dot, "rightclick", function(event) {
				$rootScope.Cables.offEditCablePolyline();
				//Dont do anything if a region selection is in progress
				if ($rootScope.Regions.adding || self.region_report_inprg) {
					return;
				}
				//Do nothing if the user is level 4 ("Comercial")
				if (LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_COMERCIAL])) {
					return;
				}

				if (accessPoint.sharedDatabase) {
					return;
				}

				if (LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) ||
					LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR])) {
					var options = {
						autoOpen: false,
						modal: true,
						title: $rootScope.Users.translateText("Atenção"),
						width: "auto",
						height: 50,
						resizable: true,
						dialogClass: "noclose noheader",
						position: {
							my: "left top",
							at: "left+" + $rootScope.mouse.mouseX + " top+" + $rootScope.mouse.mouseY,
							of: window,
							collision: "none"
						},
						create: function(event, ui) {
							$(event.target).parent().css("position", "fixed");
						},
						close: function() {
							$rootScope.menuAccessPoint = false;
						}
					};
					model = [];
					$rootScope.accessPointDeployed = accessPoint.deploy_information.deployed;
					$rootScope.accessPointId = accessPoint.id;
					$rootScope.accessPointCategory = accessPoint.category;
					$rootScope.menuAccessPoint = true;
					dialogService.open("menuAccessPoint", "menuAccessPoint", model, options).then();
				}
			});

			google.maps.event.addListener(accessPoint.dot, "dragend", function(event) {

				self.tempRecentDraggedDot = true;

				// Definir um timer para alterar para false após 2 segundos
				setTimeout(function() {
					self.tempRecentDraggedDot = false;
				}, 2000); // 2000 milissegundos = 2 segundos


				data = {};
				data.id = accessPoint.id;
				data.dot = {};
				data.dot.id = accessPoint.dot.id;
				data.dot.lat = event.latLng.lat();
				data.dot.lng = event.latLng.lng();
				data.editAddress = true; // para executar a função ctoEditAddress do Synsuite

				if ((accessPoint.circle) && (self.viewAllCircles == false)) {
					accessPoint.circle.setMap(null);
				}


				//verificar se o ponto do ponto de acesso tambem é um ponto de um cabo
				angular.forEach($rootScope.Cables.cables, function(cables, index) {
					angular.forEach(cables, function(cable, index) {
						angular.forEach(cable.dots, function(dot, index) {
							if (dot.id == accessPoint.dot.id) {
								dot.setPosition(event.latLng);
								dot.setMap(null);
								//isso acima dispara uma função 'position_changed' do ponto do cabo e faz ele atualizar o desenho sozinho

								// Garantir que comprimento do cabo seja atualizado, mandando evento dragend para
								// ponto do cabo
								google.maps.event.trigger(dot, "dragend", event);
							}
						});
					});
				});


				$.ajax({
					url: $rootScope.base_url + "/accessPoints/edit",
					type: "POST",
					data: data,
					success: function(data) {
						if (data.status == 0) {

							$rootScope.set_message(data);
						}
					},
				})
			});

			google.maps.event.addListener(accessPoint.dot, "drag", function(event) {
				//verificar se o ponto do ponto de acesso tambem é um ponto de um cabo
				angular.forEach($rootScope.Cables.cables, function(cables, indexType) {
					angular.forEach(cables, function(cable, cableIndex) {
						angular.forEach(cable.dots, function(dot, index) {
							if (dot.id == accessPoint.dot.id) {
								dot.setPosition(event.latLng);
								dot.setMap(self.map);

								// atualizar linha do cabo em tempo real
								path = $rootScope.Cables.cables[indexType][cableIndex].polyline.getPath().getArray();
								pos = new google.maps.LatLng(event.latLng.lat(), event.latLng.lng());// {lat:event.latLng.lat(),lng:event.latLng.lng()};
								path[index] = pos;
								$rootScope.Cables.cables[indexType][cableIndex].polyline.setPath(path);
							}
						});
					});
				});
				if (accessPoint.circle) {
					pos = new google.maps.LatLng(event.latLng.lat(), event.latLng.lng());
					accessPoint.circle.setCenter(pos);
				}
			});

			google.maps.event.addListener(accessPoint.dot, "dragstart", function(event) {
				if (accessPoint.circle) {
					accessPoint.circle.setMap(self.map);
				}
			});

			google.maps.event.addListener(accessPoint.dot, "mousedown", function(event) {
				$rootScope.Cables.offEditCablePolyline();
				if ((LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) || LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR])) && ((!accessPoint.deploy_information.deployed) || (accessPoint.id == $rootScope.AccessPoints.moving_id))) {
					accessPoint.dot.setDraggable(true);
				} else {
					accessPoint.dot.setDraggable(false);
				}
				if (accessPoint.sharedDatabase) {
					accessPoint.dot.setDraggable(false);
				}
			});

			google.maps.event.addListener(accessPoint.dot, "mouseover", function(event) {
				if (LevelsAndModes.isMode([LevelsAndModes.modes.MODO_COMERCIAL])) {
					$rootScope.AccessPoints.showClientsStatus(accessPoint, event);
				}
			});

			google.maps.event.addListener(accessPoint.dot, "mouseout", function(event) {
				if ($rootScope.AccessPoints.showClientsStatusDiv) {
					$rootScope.AccessPoints.hideClientsStatus();
				}
			});

		},


		/**
		 * Add Listener Building method
		 * Add all map listeners for buildings
		 * */
		addListenerBuilding: function(building) {
			google.maps.event.addListener(building.marker, "click", function(event) {
				// Dont do anything if a region selection, a region report,
				// a client connection or a cable adding is in progress.
				if ($rootScope.Regions.adding || self.region_report_inprg || $rootScope.Clients.connecting_client || $rootScope.Cables.adding) {
					return;
				}

				if ($rootScope.Ruler.started) {
					self.rulerHelper(event);
				} else {
					$rootScope.Buildings.openBuilding(building);
				}

			});

			google.maps.event.addListener(building.marker, "rightclick", function(event) {
				//Dont do anything if a region selection, a region report is in progress, or the user is level 4
				if ($rootScope.Regions.adding || self.region_report_inprg || LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_COMERCIAL])) {
					return;
				}

				if (building.sharedDatabase) {
					return;
				}

				if (LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) ||
					LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR])) {
					var options = {
						autoOpen: false,
						modal: true,
						title: $rootScope.Users.translateText("Atenção"),
						width: "auto",
						height: 50,
						resizable: true,
						dialogClass: "noclose noheader",
						position: {
							my: "left top",
							at: "left+" + $rootScope.mouse.mouseX + " top+" + $rootScope.mouse.mouseY,
							of: window,
							collision: "none"
						},
						create: function(event, ui) {
							$(event.target).parent().css("position", "fixed");
						},
						close: function() {
							$rootScope.menuAccessPoint = false;
						}
					};
					model = [];
					$rootScope.selectedBuilding = building;
					if (building.deploy_information) {
						$rootScope.buildingDeployed = building.deploy_information.deployed;
					} else {
						$rootScope.buildingDeployed = 0;
					}
					$rootScope.menuBuildingId = building.id;
					dialogService.open("menuBuilding", "menuBuilding", model, options).then();
				}
			});

			google.maps.event.addListener(building.marker, "drag", function(event) {
				// Verificar se o ponto do predio tambem é um ponto de um cabo
				angular.forEach($rootScope.Cables.cables, function(cables, index) {
					angular.forEach(cables, function(cable, index) {
						angular.forEach(cable.dots, function(dot, index) {
							if (dot.id == building.dot.id) {
								// Disparar uma função 'position_changed' do ponto do cabo e faz ele atualizar o desenho sozinho
								dot.setPosition(event.latLng);
								dot.setMap(null);
							}
						});
					});
				});
			});

			google.maps.event.addListener(building.marker, "dragend", function(event) {

				// Impede adicionar ao cabo ao arratar item em cima de um ponto
				self.tempRecentDraggedDot = true;

				// Definir um timer para alterar para false após 2 segundos
				setTimeout(function() {
					self.tempRecentDraggedDot = false;
				}, 2000);

				// Edit building to the new location
				data = {};
				data.id = building.id;
				data.dot = {};
				data.dot.id = building.dot.id;
				data.dot.lat = event.latLng.lat();
				data.dot.lng = event.latLng.lng();

				// Verificar se o ponto do predio tambem é um ponto de um cabo
				angular.forEach($rootScope.Cables.cables, function(cables, index) {
					angular.forEach(cables, function(cable, index) {
						angular.forEach(cable.dots, function(dot, index) {
							if (dot.id == building.dot.id) {
								// Disparar uma função 'position_changed' do ponto do cabo e faz ele atualizar o desenho sozinho
								dot.setPosition(event.latLng);
								dot.setMap(null);
								// Garantir que comprimento do cabo seja atualizado, mandando evento dragend para
								// ponto do cabo
								google.maps.event.trigger(dot, "dragend", event);
							}
						});
					});
				});

				// Mandar alteracoes para API
				$.ajax({
					url: $rootScope.base_url + "/buildings/edit",
					type: "POST",
					data: data,
					success: function(data) {
						if (data.status == 0) {
							$rootScope.set_message(data);
							return;
						}

						// Set the new location on the local building
						angular.forEach($rootScope.Buildings.buildings, function(current_building, idx) {
							if (current_building.id == building.id) {
								building.marker.setPosition(event.latLng);
								building.dot.lat = event.latLng.lat();
								building.dot.lng = event.latLng.lng();
							}
						});

					},
				});
			});

			google.maps.event.addListener(building.marker, "mousedown", function(event) {
				$rootScope.Cables.offEditCablePolyline();
				if (building.sharedDatabase) {
					building.marker.setDraggable(false);
				}
			});
		},



		addListenerDotCable: function(dot) {
			google.maps.event.addListener(dot, "click", function(event) {
				if ($rootScope.Ruler.started) {
					self.rulerHelper(event);
					return;
				}
			});

			google.maps.event.addListener(dot, "dragstart", function(event) {
				// Show 7 meter merge radius from dot
				dot.mergeCircle = self.drawMergeRadius(dot.position.lat(), dot.position.lng(), 7);
				dot.mergeCircle.setMap(self.map);
			});

			google.maps.event.addListener(dot, "dragend", function(event) {

				// Impede caso um ponto de acesso tenha sido arrastado para um ponto de cabo
				if (self.tempRecentDraggedDot) {
					return;
				}

				// If present, hide 7 meter merge radius
				if (dot.mergeCircle) {
					dot.mergeCircle.setMap(null)
					dot.mergeCircle = null;
				}

				data = {};
				data.old_dot = {};
				data.id = dot.cableId;
				data.old_dot.id = dot.id;
				data.old_dot.lat = event.latLng.lat();
				data.old_dot.lng = event.latLng.lng();
				//get new length, to send it to the edit function
				angular.forEach($rootScope.Cables.cables, function(cableType, indexType) {
					angular.forEach(cableType, function(cable, index) {
						if (cable.id == dot.cableId) {
							selectedCable = cable;
						}
					})
				});
				data.length = self.calculateLengthObject(selectedCable.polyline.getPath().getArray());

				var merge_position = $rootScope.Cables.isExtremity(dot);

				// MERGE COM PONTO DE ACESSO
				// Passar por todos os pontos de acesso e adicionar o cabo neles dependendo se estiver a menos de 3 metros
				// variavel first_opened, fica true quando algum accesspoint esta a menos de 10 metros do ponto.
				// Isso serve para nao abrir varias modais, quando ha um grupo de pontos de acesso na mesma regiao.
				first_opened = false;
				$rootScope.merge_access_points = [];
				$rootScope.mergeDot = dot;
				$rootScope.mergeEvent = event;
				var showModal = false;
				angular.forEach($rootScope.AccessPoints.accessPoints, function(accessPoints, indexType) {
					angular.forEach(accessPoints, function(accessPoint, index) {
						if (accessPoint.dot && accessPoint.dot.map) {
							dist = self.calculateDistance2Dots(accessPoint.dot.getPosition().lat(), accessPoint.dot.getPosition().lng(), event.latLng.lat(), event.latLng.lng());
							dist = (dist * 1000).toFixed(2);

							// In order to check if this AccessPoint is already on this cable, find cable
							// First, search in optic fiber cables
							var cableFound = $rootScope.Cables.cables[1].find(c => c.id === dot.cableId);
							if (!cableFound) {
								// If cable wasn't found, search in UTP cables.
								cableFound = $rootScope.Cables.cables[2].find(c => c.id === dot.cableId);
							}
							if (!cableFound) {
								// If the cable still wasn't found, return
								console.log("Error: NO CABLE FOUND WITH THIS ID!");
								return;
							}

							var alreadyOnCable = cableFound.dots.find(d => d.id === accessPoint.dot.id) ? true : false;
							// impedindo que rack seja adicionado no meio do cabo
							if (dist < 7 && !alreadyOnCable && !(accessPoint.category === 2 && merge_position === false)) {
								$rootScope.merge_access_points.push(accessPoint);
								showModal = true;
							}

							if ((dist < 7) && (!first_opened) && (showModal)) {
								first_opened = true;
								//setting root scope variables to be used if the user decides do complete the merge
								//         						  $rootScope.mergeDot = dot;
								//   $rootScope.mergeEvent = event;
								//Abrir uma modal para perguntar se deve adicionar o AP ao cabo:
								var options = {
									autoOpen: false,
									modal: true,
									title: $rootScope.Users.translateText("Atenção"),
									width: 300,
									height: "auto",
									resizable: true,
									dialogClass: "noclose alertModal",
								};
								//   $rootScope.messageAlert = $rootScope.Users.translateText("Voce deseja adicionar o Ponto de Acesso ") + accessPoint.name + $rootScope.Users.translateText(" ao cabo?");
								model = [];
								$rootScope.dialogService.open("mergeModal", "mergeModal", model, options);
							}
						}
					});
				});

				// MERGE COM PREDIO
				// Se o ponto atual é uma extremidade de cabo, passa por todos os prédios
				// verificando se algum esta a menos de X metros. Nesse caso abre modal pra fazer merge.

				if (merge_position) {
					first_opened = false;
					angular.forEach($rootScope.Buildings.buildings, function(building, building_index) {
						dist = self.calculateDistance2Dots(building.dot.lat, building.dot.lng, event.latLng.lat(), event.latLng.lng());
						dist = (dist * 1000).toFixed(2);
						if ((dist < 7) && (!first_opened)) {
							first_opened = true;
							$rootScope.merge_building_access_points = $rootScope.Buildings.getAccessPoints(building);
							$rootScope.merge_building = building;
							$rootScope.merge_building_cable = $rootScope.Cables.getCableFromDot(dot);
							$rootScope.merge_building_position = merge_position;
							$rootScope.merge_building_dot = dot;

							//Abrir uma modal para perguntar se deve adicionar o AP ao cabo:
							var options = {
								autoOpen: false,
								modal: true,
								title: $rootScope.Users.translateText("Atenção"),
								width: 300,
								height: "auto",
								resizable: true,
								dialogClass: "noclose alertModal",
							};
							model = [];
							$rootScope.dialogService.open("mergeBuildingModal", "mergeBuildingModal", model, options);
						}
					});
				}

				angular.forEach($rootScope.Cables.cables, function(cables, indexType) {
					angular.forEach(cables, function(cable, indexCable) {
						angular.forEach(cable.dots, function(el, index) {
							if (el.id == dot.id) {
								// TODO Erro aqui
								// Parece ser um problema mais profundo:
								// A variavel cable abaixo é um dos cabos encontrados em $rootSceop.Cables.cables.
								// Ao invés de esses cabos estarem salvos como objetos, estão salvos em memória como arrays.
								// Por isso, atribuir o campo length no array não é permitido, já que é um atributo protegido
								// to tipo "array".
								//
								// Estou removendo essa atualização temporariamente, para averiguar melhor por que
								// a lista de cables está salvando eles como array ao invés de objetos.

								// This ensures cable length is updated right away
								// cable["length"] = parseFloat(data.length).toFixed(2);

								pos = new google.maps.LatLng(dot.getPosition().lat(), dot.getPosition().lng());
								el.setPosition(pos);
							}
						});
					});
				});

				//atualizar o pondo do cabo
				$.ajax({
					url: $rootScope.base_url + "/cables/edit",
					type: "POST",
					data: data,
					success: function(data) {
						if (data.status == 0) {
							$rootScope.set_message(data);
						}
						$rootScope.$digest();
					},
				})
			});

			google.maps.event.addListener(dot, "position_changed", function() {
				// Atualizar o desenho do cabo
				cont = 0;
				indices = [];
				angular.forEach($rootScope.Cables.cables, function(cables, indexType) {
					angular.forEach(cables, function(cable, indexCable) {
						// Aqui eu vou encontrar os cabos que usam este ponto e atualizar o ponto neles tambem
						angular.forEach(cable.dots, function(el, index) {
							if (el.id == dot.id) {
								//setar a posição do marker do ponto e atualizar a polilyne
								// salvar index do cabo e atualizar o ponto
								indices.push(indexCable);
								newPath = [];
								path = cable.polyline.getPath().getArray();
								path[index] = new google.maps.LatLng(dot.getPosition().lat(), dot.getPosition().lng());
								newPath = path;
								cable.polyline.setPath(newPath);
							}
						});

					});
				});


				// Verificar os pontos de acesso que estao neste ponto e atualizar
				angular.forEach($rootScope.AccessPoints.accessPoints, function(accessPoints, index) {
					angular.forEach(accessPoints, function(accessPoint, index) {
						if (accessPoint.dot) {
							if (accessPoint.dot.id == dot.id) {
								pos = new google.maps.LatLng(dot.getPosition().lat(), dot.getPosition().lng());
								accessPoint.dot.setPosition(pos);
							}
						}
					});
				});

				// Verificar as reservas que estao neste ponto e atualizar
				angular.forEach($rootScope.Reserves.reserves, function(reserve, index) {

					if (reserve.dot.id == dot.id) {
						pos = new google.maps.LatLng(dot.getPosition().lat(), dot.getPosition().lng());
						reserve.dot.setPosition(pos);
					}
				});

				// Verificar os postes que estao neste ponto e atualizar
				angular.forEach($rootScope.Posts.posts, function(post, index) {
					if (post.dot.id == dot.id) {
						pos = new google.maps.LatLng(dot.getPosition().lat(), dot.getPosition().lng());
						post.dot.setPosition(pos);
					}
				});

				// Verificar os clientes que estao neste ponto e atualizar
				angular.forEach($rootScope.Clients.clients, function(client, index) {
					if (client.dot) {
						if (client.dot.id == dot.id) {
							pos = new google.maps.LatLng(dot.getPosition().lat(), dot.getPosition().lng());
							client.marker.setPosition(pos);
						}
					}
				});

				// Atualizar desenho de regiao de merge, caso ela esteja aparecendo
				if (dot.mergeCircle) {
					pos = new google.maps.LatLng(dot.getPosition().lat(), dot.getPosition().lng());
					dot.mergeCircle.setCenter(pos);
				}

			});

			google.maps.event.addListener(dot, "rightclick", function(event) {
				if (LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) ||
					LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR])) {
					var options = {
						autoOpen: false,
						modal: true,
						title: $rootScope.Users.translateText("Atenção"),
						width: "auto",
						height: 50,
						resizable: true,
						dialogClass: "noclose noheader",
						position: {
							my: "left top",
							at: "left+" + $rootScope.mouse.mouseX + " top+" + $rootScope.mouse.mouseY,
							of: window,
							collision: "none"
						},
						create: function(event, ui) {
							$(event.target).parent().css("position", "fixed");
						},
						close: function() {
							$rootScope.menuAccessPoint = false;
						}
					};
					model = [];
					$rootScope.dotSelected = dot;

					angular.forEach($rootScope.Cables.cables, function(cables, indexType) {
						angular.forEach(cables, function(cable, indexCable) {
							// Aqui eu vou encontrar os cabos que usam este ponto e atualizar o ponto neles tambem
							angular.forEach(cable.dots, function(el, index) {
								if (el.id == dot.id) {
									$rootScope.Cables.cableSelected = cable;
								}
							});

						});
					});

					$rootScope.Cables.findPositionOnCable($rootScope.Cables.cableSelected, event).then(function(r) {
						if (r) {
							$rootScope.Cables.positionOnCable = r;

							dialogService.open("menuDotCable", "menuDotCable", model, options).then();
						} else {
							$rootScope.message_error = $rootScope.Users.translateText("Aproxime o zoom ou clique em outro ponto do cabo");
							$timeout(function() {
								$rootScope.message_error = "";
							}, 7000);
						}
					});


				}
			});
		},

		/**
		 * Get event page x y
		 * I'm not sure why, but the variable that holds pageX and pageY values changes names - once it was Qb, then Ob, then Nb.
		 * To work around that, this function seaches for the values in every key in the event object, and returns the right one
		 *
		 * */
		getEventPageXY: function(event) {
			return_array = null;
			angular.forEach(event, function(variable, var_index) {
				if (variable) {
					if ("pageX" in variable) {
						return_array = [];
						return_array.pageX = variable.pageX;
						return_array.pageY = variable.pageY;
					}
				}
			});
			return return_array;
		},

		getPointFromLatLng: function(event) {
			if (!event.latLng) {
				return false;
			}
			var latLng = event.latLng
			var projection = self.map.getProjection();
			var bounds = self.map.getBounds();
			var topRight = projection.fromLatLngToPoint(bounds.getNorthEast());
			var bottomLeft = projection.fromLatLngToPoint(bounds.getSouthWest());
			var scale = Math.pow(2, self.map.getZoom());
			var worldPoint = projection.fromLatLngToPoint(latLng);
			return [Math.floor((worldPoint.x - bottomLeft.x) * scale), Math.floor((worldPoint.y - topRight.y) * scale)];
		},

		addListenerCable: function(cable) {
			google.maps.event.addListener(cable.polyline, "rightclick", function(event) {
				//Do nothing if the user is level 4 ("Comercial")
				if (LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_COMERCIAL])) {
					return;
				}
				if ($rootScope.Ruler.started) {
					self.rulerHelper(event);
					return;
				}

				if (cable.sharedDatabase) {
					return;
				}

				if ($rootScope.Cables.cableHasError(cable.id)) {
					$rootScope.message_error = $rootScope.Users.translateText("Operação impedida pois o cabo está com erro. Entre em contato com o suporte para correção.");
					$timeout(function() {
						$rootScope.message_error = "";
					}, 7000);
					return;
				}

				if (LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) ||
					LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR])) {
					//Dont do anything if a region selection is in progress
					if ($rootScope.Regions.adding || self.region_report_inprg) {
						return;
					}
					//Gets the right values, regardless of what variable is holding them
					page_coords = self.getEventPageXY(event);

					pixX = page_coords.pageX;
					pixY = page_coords.pageY;

					var options = {
						autoOpen: false,
						modal: true,
						title: "",
						resizable: true,
						dialogClass: "noclose noheader",
						position: {
							my: "left top",
							at: "left+" + pixX + " top+" + pixY,
							of: window,
							collision: "none"
						},
						close: function() {
							$rootScope.menuCable = false;
							if (!$rootScope.Cables.usingPositionOnCable) {
								$rootScope.Cables.positionOnCable = false;
							}
						}
					};

					if (cable.category == 1) {
						options.height = "auto";
						options.width = 215;
					}
					if (cable.category == 2) {
						options.height = "auto";
						options.width = 215;
					}
					if (cable.category == 3) {
						options.height = "auto";
						options.width = 195;
					}
					if (cable.category == 4) {
						options.height = 45;
						options.width = 195;
					}

					model = [];
					$rootScope.Cables.positionOnCable = false;
					$rootScope.Cables.cableSelected = false;
					$rootScope.menuCable = false;
					//if(self.validateProject(cable.project,0)){
					$rootScope.menuCable = true;
					$rootScope.Cables.findPositionOnCable(cable, event).then(function(r) {
						if (r) {
							$rootScope.Cables.positionOnCable = r;
							$rootScope.Cables.cableSelected = cable;
							dialogService.open("menuCable", "menuCable", model, options).then();
						} else {
							$rootScope.message_error = $rootScope.Users.translateText("Aproxime o zoom ou clique em outro ponto do cabo");
							$timeout(function() {
								$rootScope.message_error = "";
							}, 7000);
						}
					});

					//}
				}
			});

			google.maps.event.addListener(cable.polyline, "mouseover", function(event) {
				if (cable.category == 4) {
					cable.polyline.setOptions({ strokeWeight: 2 });
				} else {
					cable.polyline.setOptions({ strokeWeight: 6 });
					let name = cable.name
						+ ($rootScope.Cables.cableHasError(cable.id) ? " [ ⚠️ CABO COM ERRO]" : "")
					$rootScope.Cables.showCableNameFunc(name, event);
				}
			});
			google.maps.event.addListener(cable.polyline, "mouseout", function(event) {
				if (cable.category == 4) {
					cable.polyline.setOptions({ strokeWeight: 1 });
				} else {
					cable.polyline.setOptions({ strokeWeight: 4 });
					$rootScope.Cables.hideCableName();
				}
			});

			google.maps.event.addListener(cable.polyline, "dblclick", function(event) {
				if ($rootScope.Regions.adding || self.region_report_inprg) {
					return;
				}
				if ($rootScope.Ruler.started) {
					self.rulerHelper(event);
					return;
				}

				if (cable.sharedDatabase) {
					return;
				}

				if ($rootScope.Cables.cableHasError(cable.id)) {
					$rootScope.message_error = $rootScope.Users.translateText("Operação impedida pois o cabo está com erro. Entre em contato com o suporte para correção.");
					$timeout(function() {
						$rootScope.message_error = "";
					}, 7000);
					return;
				}

				//Do nothing if the user is level 4 ("Comercial")
				if (LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_COMERCIAL])) {
					return;
				}
				if (LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) ||
					LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR])) {
					//deixar editavel
					$rootScope.Cables.editPolyline(cable);
					//In order not to open the description modal for the cable, when exiting the edit mode.
					$rootScope.justEdited = true;
					$timeout(function() { $rootScope.justEdited = false; }, 700);
				}
			});


			google.maps.event.addListener(cable.polyline, "click", function(event) {
				if ($rootScope.Regions.adding || self.region_report_inprg) {
					return;
				}
				if ($rootScope.Ruler.started) {
					self.rulerHelper(event);
					return;
				}
				//Do nothing if the user is level 4 ("Comercial")
				if (LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_COMERCIAL])) {
					return;
				}

				if ($rootScope.Cables.editing) {
					$rootScope.Cables.offEditCablePolyline();
				}

				$timeout(function() {
					if ((!$rootScope.justEdited)) {
						var options = {
							autoOpen: false,
							modal: true,
							title: $rootScope.Users.translateText("Atenção"),
							width: 300,
							height: "auto",
							resizable: true,
							dialogClass: "noclose alertModal",
						};
						$rootScope.messageAlert = "<h6>" + $rootScope.Users.translateText("Nome") + ": " + cable.name +
							"</h6><span>" + $rootScope.Users.translateText("Proprietário") + ": " + cable.owner +
							"</span><br><span>" + $rootScope.Users.translateText("Tipo") + ": " + cable.type_name +
							"</span><br><span>" + $rootScope.Users.translateText("Comprimento (no mapa)") + ": " + self.calculateLengthObject(cable.polyline.getPath().getArray()) +
							"mts</span> <br> <span>" + $rootScope.Users.translateText("Comprimento Total") + ": " + $rootScope.Cables.getTotalLength(cable) + "mts</span>";//cable.total_length
						model = [];
						$rootScope.dialogService.open("alertModal", "alertModal", model, options).then();
					}
				}, 600);
			});
		},

		/**
		 *
		 *
		 * @param {obj} polyline
		 */
		addListenerViabilityDropCable: function(polyline) {
			// Add listeners on mouseover and mousout - Change width and show DROP length
			google.maps.event.addListener(polyline, "mouseover", function(event) {
				polyline.setOptions({ strokeWeight: 8 });
				$rootScope.Cables.showCableNameFunc("Cabo DROP - " + polyline.length + " metros.", event);
			});
			google.maps.event.addListener(polyline, "mouseout", function(event) {
				polyline.setOptions({ strokeWeight: 4 });
				$rootScope.Cables.hideCableName();
			});
		},

		/**
		 *
		 *
		 * @param {obj} accessPointMarker
		 */
		addListenerViabilityAccessPoint: function(accessPoint, accessPointMarker) {
			// Add listeners on mouseover and mousout - Change width and show DROP length
			google.maps.event.addListener(accessPointMarker, "mouseover", function(event) {
				console.log("mouseover", accessPoint, accessPointMarker);
				$rootScope.AccessPoints.showClientsStatus(accessPoint, event, true);
			});
			google.maps.event.addListener(accessPointMarker, "mouseout", function(event) {
				console.log("mouseout", accessPoint, accessPointMarker);
				$rootScope.AccessPoints.hideClientsStatus();
			});
		},


		addListenerDotRegion: function(dot) {
			google.maps.event.addListener(dot, "dragstart", function(event) {
				//encontrar region.shape para ser editado
				angular.forEach($rootScope.Regions.regions, function(val, index) {
					if (val.id == dot.regionId) {
						$rootScope.regionEditingIndex = index;
					}
				})
			});
			google.maps.event.addListener(dot, "drag", function(event) {
				path = $rootScope.Regions.regions[$rootScope.regionEditingIndex].shape.getPath().getArray();
				pos = new google.maps.LatLng(event.latLng.lat(), event.latLng.lng());//{lat:event.latLng.lat(),lng:event.latLng.lng()};
				path[dot.index] = pos;
				$rootScope.Regions.regions[$rootScope.regionEditingIndex].shape.setPath(path);
			});
		},


		addListenerRegion: function(region) {
			google.maps.event.addListener(region.shape, "click", function(event) {
				if ($rootScope.Regions.adding) {
					self.regionHelper(event);
				} else if ($rootScope.Cables.adding) {
					self.cableHelper(event, 1, false, false);
				} else if ($rootScope.Ruler.started) {
					self.rulerHelper(event);
					return;
				} else {
					if (LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) ||
						LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR])) {
						page_coords = self.getEventPageXY(event);
						pixX = page_coords.pageX;
						pixY = page_coords.pageY;
						var options = {
							autoOpen: false,
							modal: true,
							title: $rootScope.Users.translateText("Menu Região"),
							width: 140,
							height: "auto",
							resizable: true,
							dialogClass: "noclose",
							position: {
								my: "left top",
								at: "left+" + pixX + " top+" + pixY,
								of: window,
								collision: "none"
							},
						};
						model = [];
						$rootScope.Regions.selectedRegion = region;
						$rootScope.dialogService.open("menuRegion", "menuRegion", model, options).then();
					}
				}
			});

			google.maps.event.addListener(region.shape, "rightclick", function(event) {
				if (LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) ||
					LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR])) {
					if (!$rootScope.Regions.adding && !$rootScope.Cables.adding && !$rootScope.Ruler.started) {
						page_coords = self.getEventPageXY(event);
						pixX = page_coords.pageX;
						pixY = page_coords.pageY;
						var options = {
							autoOpen: false,
							modal: true,
							title: $rootScope.Users.translateText("Menu Região"),
							width: 140,
							height: "auto",
							resizable: true,
							dialogClass: "noclose",
							position: {
								my: "left top",
								at: "left+" + pixX + " top+" + pixY,
								of: window,
								collision: "none"
							},
						};
						model = [];
						$rootScope.Regions.selectedRegion = region;
						$rootScope.dialogService.open("menuRegion", "menuRegion", model, options).then();
					}
				}
			});

			google.maps.event.addListener(region.shape, "mousedown", function(event) {
				$rootScope.Cables.offEditCablePolyline();
			});

		},


		addListenerNote: function(note) {
			google.maps.event.addListener(note.marker, "dragend", function(event) {
				data = {};
				data.id = note.id;
				data.dot = {};
				data.dot.lat = event.latLng.lat();
				data.dot.lng = event.latLng.lng();
				$.ajax({
					url: $rootScope.base_url + "/notes/edit",
					type: "POST",
					data: data,
					success: function(data) {
						if (data.status == 0) {
							$rootScope.set_message(data);
						}
					},
				})
			});
			google.maps.event.addListener(note.marker, "click", function() {
				note.note.open(self.map, note.marker);
			});
			google.maps.event.addListener(note.marker, "rightclick", function() {
				//Do nothing if the user is level 4 ("Comercial")
				if (LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_COMERCIAL])) {
					return;
				}
				var options = {
					autoOpen: false,
					modal: true,
					title: $rootScope.Users.translateText("Atenção"),
					width: 300,
					height: "auto",
					resizable: true,
					dialogClass: "noclose",
				};
				model = [];
				$rootScope.note_id = note.id;
				$rootScope.dialogService.open("noteDelete", "noteDelete", model, options).then();
			});
			google.maps.event.addListener(note.marker, "dblclick", function() {
				//Do nothing if the user is level 4 ("Comercial")
				if (LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_COMERCIAL])) {
					return;
				}
				note.note.close();
				var options = {
					autoOpen: false,
					modal: true,
					title: $rootScope.Users.translateText("Editar nota"),
					width: 300,
					height: "auto",
					resizable: true,
					dialogClass: "noclose",
				};
				model = [];
				$rootScope.Notes.editing = true;
				$rootScope.form = note;
				dialogService.open("noteAdd", "noteAdd", model, options).then();
			});

			google.maps.event.addListener(note.marker, "mousedown", function(event) {
				$rootScope.Cables.offEditCablePolyline();
			});
		},



		addListenerClient: function(client) {
			google.maps.event.addListener(client.marker, "mousedown", function(event) {
				$rootScope.Cables.offEditCablePolyline();
				if ((LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) ||
					LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR]))
					&& !client.deploy_information.deployed) {
					client.marker.setDraggable(true);
				} else {
					client.marker.setDraggable(false);
				}
				if (client.sharedDatabase) {
					client.marker.setDraggable(false);
				}
			});

			google.maps.event.addListener(client.marker, "dragend", function(event) {

				// Impede adicionar ao cabo ao arratar item em cima de um ponto
				self.tempRecentDraggedDot = true;

				// Definir um timer para alterar para false após 2 segundos
				setTimeout(function() {
					self.tempRecentDraggedDot = false;
				}, 2000);

				data = {};
				data.id = client.id;
				data.dot = {};
				data.dot.lat = event.latLng.lat();
				data.dot.lng = event.latLng.lng();

				//verificar se o ponto do cliente tambem é um ponto de um cabo
				angular.forEach($rootScope.Cables.cables, function(cables, index) {
					angular.forEach(cables, function(cable, index) {
						angular.forEach(cable.dots, function(dot, index) {
							if (dot.id == client.dot.id) {
								dot.setPosition(event.latLng);
								dot.setMap(null);
								//isso acima dispara uma função 'position_changed' do ponto do cabo e faz ele atualizar o desenho sozinho
								// Garantir que comprimento do cabo seja atualizado, mandando evento dragend para
								// ponto do cabo
								google.maps.event.trigger(dot, "dragend", event);
							}
						});
					});
				});
				$.ajax({
					url: $rootScope.base_url + "/clients/edit",
					type: "POST",
					data: data,
					success: function(data) {
						if (data.status == 0) {
							$rootScope.set_message(data);
						}
					},
				})
			});

			google.maps.event.addListener(client.marker, "drag", function(event) {
				//verificar se o ponto do cliente tambem é um ponto de um cabo
				angular.forEach($rootScope.Cables.cables, function(cables, indexType) {
					angular.forEach(cables, function(cable, cableIndex) {
						angular.forEach(cable.dots, function(dot, index) {
							if (dot.id == client.dot.id) {
								dot.setPosition(event.latLng);
								dot.setMap(self.map);

								// atualizar linha do cabo em tempo real
								path = $rootScope.Cables.cables[indexType][cableIndex].polyline.getPath().getArray();
								pos = new google.maps.LatLng(event.latLng.lat(), event.latLng.lng());//{lat:event.latLng.lat(),lng:event.latLng.lng()};
								path[index] = pos;
								$rootScope.Cables.cables[indexType][cableIndex].polyline.setPath(path);

							}
						});
					});
				});
			});

			google.maps.event.addListener(client.marker, "click", function(event) {
				//Dont do anything if a region selection is in progress
				if ($rootScope.Regions.adding || self.region_report_inprg) {
					return;
				}
				if ($rootScope.Ruler.started) {
					self.rulerHelper(event);
				}

				else if (!$rootScope.Cables.editing && !$rootScope.Cables.adding) {
					if (!client.ap_id_connected) {
						if (!$rootScope.Clients.connecting_client) {
							$rootScope.Clients.connecting_client = true;
							$rootScope.Clients.blink(client, true);
						} else {
							$rootScope.Clients.connecting_client = false;
							$rootScope.Clients.blink(client, false);
						}
					} else {
						$timeout(function() {
							var options = {
								autoOpen: false,
								modal: true,
								title: "Cliente",
								width: 300,
								height: "auto",
								resizable: true,
								dialogClass: "noclose alertModal",
								close: function() {
									$rootScope.showClient = null;
								},
							};
							$rootScope.showClient = client;
							model = [];
							$rootScope.dialogService.open("clientDetails", "clientDetails", model, options).then();
						}, 500);
					}
				}
			});

			google.maps.event.addListener(client.marker, "rightclick", function() {
				//Dont do anything if a region selection is in progress
				if ($rootScope.Regions.adding || self.region_report_inprg) {
					return;
				}

				if (client.sharedDatabase) {
					return;
				}

				if (LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) ||
					LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR]) || LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_COMERCIAL])) {
					var options = {
						autoOpen: false,
						modal: true,
						title: "",
						height: $rootScope.identifier.erp_integration_active ? 90 : 50,
						width: 200,
						resizable: true,
						dialogClass: "noclose noheader",
						position: {
							my: "left top",
							at: "left+" + $rootScope.mouse.mouseX + " top+" + $rootScope.mouse.mouseY,
							of: window,
							collision: "none"
						},
						close: function() {
							$rootScope.menuClient = false;
						}
					};
					model = [];
					$rootScope.Clients.clientSelected = false;
					$rootScope.menuClient = false;
					//if(self.validateProject(client.project,0)){
					$rootScope.menuClient = true;
					$rootScope.Clients.clientSelected = client;
					dialogService.open("menuClient", "menuClient", model, options).then();
					//}
				}
			});
		},

		////////////////////////////////////////////////////////////////// DESENHOS //////////////////////////////////////////////////////////////


		drawPolyline: function(path, name, cor, deployed, drop) {
			//Set opacity based on deploy status
			if ((typeof (deployed != undefined)) && (deployed == false)) {
				opacity = 0.55;
			} else {
				opacity = 1.0;
			}
			//Set weight of line, based on type - drop or not
			if (drop) {
				weight = 1;
				opacity = 1.0;
			} else {
				weight = 4;
			}
			var poly = new google.maps.Polyline({
				strokeColor: cor,
				strokeOpacity: opacity,
				strokeWeight: weight,
				path: path,
				nome: name,
				edit: false
			});
			poly.setMap(null);
			return poly;
		},

		/**
		 * Cria marcador SVG e transforma icone para PNG antes de setar icone no marcador
		 *
		 *
		 * @param {*} lat
		 * @param {*} lng
		 * @param {*} type one of the following: ["client"]
		 * @param {*} name
		 * @param {*} description
		 * @param {*} deployed
		 * @param {*} color
		 * @param {*} strokeColor
		 */
		drawSVGMarker: function(lat, lng, type, name, description, deployed, color, strokeColor) {
			//Decidindo se podera arrastar itens no mapa
			var draggable = false;
			if ((LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) ||
				LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR])) && deployed == 0) {
				draggable = true;
			} else {
				draggable = false;
			}

			// Prepare Marker
			var title = (description != "") ? name + " - " + description : name;
			var marker = new google.maps.Marker({
				position: new google.maps.LatLng(lat, lng),
				map: null,
				title: title,
				draggable: draggable,
			});

			// Prepare SVG Attributes
			var strokeWidth = deployed ? "3" : "1";
			var strokeColor = strokeColor;
			var fillColor = color;
			var margin = 2;

			// Generate PNG and then set icon
			$rootScope.MarkerImage.generatePngFromSvg(type, fillColor, strokeColor, strokeWidth, margin).then(function(pngIconUrl) {
				//marker.setIcon(pngIconUrl);

				var icon = {
					url: pngIconUrl, // url
				};

				if (type === "caixa_quadrada" || type === "mini_caixa" || type === "camera") {
					icon = {
						url: pngIconUrl, // url
						anchor: new google.maps.Point(10, 18) // anchor
					};
				}

				marker.setIcon(icon);
			});

			// Return marker (happens before the icon being set)
			return marker;
		},

		/**
		 * Method to create a more simple marker, without callbacks etc
		 *
		 * Used, for instance, by the viability feature to quickly show
		 * markers on a map in a modal
		 */
		drawSimpleMarker: function(labelText, icon, lat, lng) {
			var label = {
				text: labelText,
				color: "black",
				fontWeight: "bold",
				fontSize: "14px"
			};
			var icon = {
				url: $rootScope.base_url + "/img/icons_map/" + icon,
				size: new google.maps.Size(71, 71),
				origin: new google.maps.Point(0, 0),
				anchor: new google.maps.Point(17, 34),
				scaledSize: new google.maps.Size(25, 25)
			};
			var marker = new google.maps.Marker({
				icon: icon,
				position: new google.maps.LatLng(lat, lng),
				title: labelText,
				draggable: false,
				label: label
			});
			return marker;
		},


		drawMarker: function(lat, lng, dot_id, icon, name, description, deployed, color, path, OnuSignalColor) {
			var icone, mark, aux_color, strokeWeight;

			if (icon.indexOf("cliente") === 0) {
				if (deployed) {
					strokeWeight = 2;
				} else {
					strokeWeight = 1;
				}

				var strokeColor = "black";

				if (OnuSignalColor) {
					strokeColor = OnuSignalColor;
				}



				icone = {
					path: path,
					fillColor: color,
					fillOpacity: 1,
					strokeColor: strokeColor,
					strokeWeight: strokeWeight,
					scale: 0.55,
					anchor: new google.maps.Point(15, 20) //ajusta a posiçao
				}
			} else {
				if (color) {
					switch (color) {
						case "1":
							aux_color = "";
							break;
						case "2":
							aux_color = "red_";
							break;
						case "3":
							aux_color = "green_";
							break;
						case "4":
							aux_color = "blue_";
							break;
						case "5":
							aux_color = "yellow_";
							break;
						case "6":
							aux_color = "purple_";
							break;
						case "7":
							aux_color = "white_";
							break;
						case "8":
							aux_color = "brown_";
							break;
						case "9":
							aux_color = "pink_";
							break;
						case "10":
							aux_color = "orange_";
							break;
						case "11":
							aux_color = "skyBlue_";
							break;
					}
				} else { //case undefined
					aux_color = "";
				}

				if (deployed) {
					icon = icon.split(".");
					icone = $rootScope.base_url + "/img/icons_map/" + aux_color + icon[0] + "_deployed.png";
				} else {
					icone = $rootScope.base_url + "/img/icons_map/" + aux_color + icon;
				}
			}

			if (description != "") {
				title = name + " - " + description
			} else {
				title = name;
			}
			//Decidindo se podera arrastar itens no mapa
			if ((LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) ||
				LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR])) && deployed == 0) {
				draggable = true;
			} else {
				draggable = false;
			}

			mark = new google.maps.Marker({
				icon: icone,
				position: new google.maps.LatLng(lat, lng),
				map: null,
				title: title,
				draggable: draggable,
			});

			return mark;
		},

		drawNote: function(title, content, date) {
			var contentString = "<div id=\"content\">" +
				"<div id=\"siteNotice\">" +
				"</div>" +
				"<h4 id=\"firstHeading\" class=\"firstHeading\">" + title + "</h4>" +
				"<h6 class=\"firstHeading\">" + date + "</h6>" +
				"<div id=\"bodyContent\">" +
				"<p>" + content + "</p>" +
				"</div>" +
				"</div>";

			var infowindow = new google.maps.InfoWindow({
				content: contentString,
				maxWidth: 300
			});
			return infowindow;
		},

		drawAccessPointNameInfowindow: function(name) {

			var contentString = "" +
				"<div id=\"content\">" +
				//'<h5 id="firstHeading" class="firstHeading">'+name+'</h5>'+
				name +
				"</div>";

			var infowindow = new google.maps.InfoWindow({
				content: contentString,
				disableAutoPan: true
			});
			return infowindow;
		},

		drawShape: function(path, color) {
			var shape = new google.maps.Polygon();
			shape.setOptions({
				fillColor: color,
				strokeColor: color,
				strokeOpacity: 0.2,
				fillOpacity: 0.3,
				map: null,
				paths: path,
				dragable: true,
				editable: false,
				visible: true,
				zIndex: 5000,
				clickable: true,
			});
			return shape;
		},

		rgbToHex: function(R, G, B) { return "#" + self.toHex(R) + self.toHex(G) + self.toHex(B) },
		toHex: function(n) {
			n = parseInt(n, 10);
			if (isNaN(n)) return "00";
			n = Math.max(0, Math.min(n, 255));
			return "0123456789ABCDEF".charAt((n - n % 16) / 16) + "0123456789ABCDEF".charAt(n % 16);
		},

		drawCircle: function(lat, lng, raio, accessPoint) {
			//If the user is level 4 "Comercial", show gradient color on access point areas.
			if (LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_COMERCIAL])) {
				if (accessPoint.percentage_free) {
					percentage_free = accessPoint.percentage_free;
				} else {
					percentage_free = 1; // comentado pois é feito ao clicar no toggle $rootScope.AccessPoints.getPercentageFreePorts(accessPoint);
				}
				var r = 100;//Math.floor(100 + (percentage_free * 0.75));
				var g = Math.floor(percentage_free * 2);
				var b = 155 + percentage_free;//255 - percentage_free;
				//generate opacity
				var opacity = 0.7 - (percentage_free * 0.004);
				var color = self.rgbToHex(r, g, b)
			} else {
				var color = "#64C8FF";
				var opacity = 0.3;
			}
			var circ = new google.maps.Circle();
			circ.setOptions({
				center: new google.maps.LatLng(lat, lng),
				fillColor: color,
				fillOpacity: opacity,
				strokeColor: "#71B8FF",
				strokeOpacity: 0.3,
				map: null,
				visible: true,
				radius: raio,
				editable: false,
			});
			return circ;
		},

		drawMergeRadius: function(lat, lng, raio) {
			var circ = new google.maps.Circle();
			circ.setOptions({
				center: new google.maps.LatLng(lat, lng),
				fillColor: "#2ecc71",
				fillOpacity: 0.3,
				strokeColor: "#20a358",
				strokeOpacity: 0.3,
				map: null,
				visible: true,
				radius: raio,
				editable: false,
			});
			return circ;
		},


		////////////////////////////////////////////////////////////////// UTEIS //////////////////////////////////////////////////////////////

		openInProgressMessage: function(status_object) {
			//Open Modal
			var options = {
				autoOpen: false,
				modal: true,
				title: $rootScope.Users.translateText("Atenção"),
				width: "400",
				height: "auto",
				dialogClass: "inProgressMessage",
				resizable: false,
				close: function() { },
			};
			model = [];
			$rootScope.inprogressmessage = status_object;
			$rootScope.dialogService.open("inProgressMessage", "inProgressMessage", model, options);
		},

		//para array
		//nao usar tava dando pau e errando nas medidas
		// calculateLengthArray : function(pontos){
		//          var tamanho = 0;
		//          if(Functions.count_object(pontos) == 1)return 0;
		//          for(i = 0; i<Functions.count_object(pontos)-1; i++){
		//           tamanho = tamanho + self.calculateDistance2Dots(pontos[i].lat, pontos[i].lng, pontos[i+1].lat, pontos[i+1].lng)
		//      }
		//       //transforma km em m
		//       return (tamanho*1000).toFixed(2);
		// },


		calculateLengthObject: function(pontos) {
			var tamanho = 0;

			if (Functions.count_object(pontos) == 1) {
				//only one point
				return 0;
			}
			for (i = 0; i < Functions.count_object(pontos) - 1; i++) {
				tamanho = tamanho + self.calculateDistance2Dots(pontos[i].lat(), pontos[i].lng(), pontos[i + 1].lat(), pontos[i + 1].lng());
			}
			//transforma km em m
			length = (tamanho * 1000).toFixed(2);
			return length;
		},


		calculateDistance2Dots: function(lat1, lng1, lat2, lng2) {
			//formula matematica para calculo distancia
			if ((lat1 != lat2) || (lng1 != lng2)) {
				dist = (6371 * Math.acos(Math.cos(Math.PI * (90 - lat2) / 180) * Math.cos((90 - lat1) *
					Math.PI / 180) + Math.sin((90 - lat2) *
						Math.PI / 180) * Math.sin((90 - lat1) *
							Math.PI / 180) * Math.cos((lng1 - lng2) *
								Math.PI / 180)));
				if (isNaN(dist)) {
					console.warn("Warning: calculated distance between dots is NaN. Dot 1:", lat1, lng1, "Dot 2: ", lat2, lng2);
					dist = 0;
				}
				return dist;
			} else {
				return 0;
			}
		},

		fromLatLngToPoint: function(latLng, map) {
			var topRight = map.getProjection().fromLatLngToPoint(map.getBounds().getNorthEast());
			var bottomLeft = map.getProjection().fromLatLngToPoint(map.getBounds().getSouthWest());
			var scale = Math.pow(2, map.getZoom());
			var worldPoint = map.getProjection().fromLatLngToPoint(latLng);
			return new google.maps.Point((worldPoint.x - bottomLeft.x) * scale, (worldPoint.y - topRight.y) * scale);
		},

		////////////////////////////////////////////////////////////////// PARA JUNTAR CABO E AP (ARRASTANDO CABO PARA CIMA DO AP) //////////////////////////////////////////////////////////////

		mergeCancel: function() {
			$rootScope.dialogService.close("mergeModal");
			$rootScope.mergeDot = [];
			$rootScope.mergeEvent = [];
		},


		mergeConfirm: function(selectedAccessPoint) {
			$rootScope.dialogService.close("mergeModal");
			dot = $rootScope.mergeDot;
			event = $rootScope.mergeEvent;

			data = {};
			data.old_dot = {};
			data.id = dot.cableId;
			data.old_dot.id = dot.id;
			data.old_dot.lat = event.latLng.lat();
			data.old_dot.lng = event.latLng.lng();
			//get new length, to send it to the edit function
			angular.forEach($rootScope.Cables.cables, function(cableType, indexType) {
				angular.forEach(cableType, function(cable, index) {
					if (cable.id == dot.cableId) {
						selectedCable = cable;
						angular.forEach(cable.dots, function(el, index) {
							if (el.id == dot.id) {
								pos = new google.maps.LatLng(dot.getPosition().lat(), dot.getPosition().lng());
								el.setPosition(pos);
							}
						});
					}
				})
			});
			data.length = self.calculateLengthObject(selectedCable.polyline.getPath().getArray());

			dataMerge = {};
			dataMerge.cable = {};
			dataMerge.cable.dot = {};
			dataMerge.access_point = {};
			dataMerge.access_point.dot = {}
			dataMerge.project = selectedAccessPoint.project;

			dataMerge.cable.dot.id = dot.id;
			dataMerge.cable.dot.lat = event.latLng.lat();
			dataMerge.cable.dot.lng = event.latLng.lng();
			dataMerge.cable.id = dot.cableId;
			dataMerge.access_point.id = selectedAccessPoint.id;
			dataMerge.access_point.dot.id = selectedAccessPoint.dot.id;

			stop = false;
			if (selectedCable.category == 1 && selectedAccessPoint.category == 3) {
				//CONECTANDO UM CABO DE FIBRA (1) A UMA PAC (3)
				//verificar se o pac é pon
				angular.forEach($rootScope.AccessPoints.accessPointTypes, function(el, value) {
					if (el.id == selectedAccessPoint.access_point_type_id) {
						if (!el.pon) {
							var options = {
								autoOpen: false,
								modal: true,
								title: $rootScope.Users.translateText("Atenção"),
								width: 300,
								height: "auto",
								resizable: true,
								dialogClass: "noclose alertModal",
							};
							$rootScope.messageAlert = $rootScope.Users.translateText("Voce não pode adicionar um cabo de fibra a um pac que não seja PON. O cabo será movido mas não será vinculado");
							model = [];
							$rootScope.dialogService.open("alertModal", "alertModal", model, options).then();
							stop = true;
							return;
						} else {
							$rootScope.Cables.findPositionOnCable(selectedCable, event).then(function(r) {
								if (r.positioning == "begin") {
									dataMerge.position = 1;
								}
								if (r.positioning == "end") {
									dataMerge.position = 3;
								}
								if (r.positioning == "middle") {
									dataMerge.position = 2;
								}
								$rootScope.Cables.merge_with_ap(dataMerge);
								stop = true;
							});

						}
					}
				});
				if (stop) {
					return;
				}
			} else if (selectedCable.category == 1) {
				//CONECTANDO UM CABO DE FIBRA (1) A ALGO QUE NAO EH PAC
				$rootScope.Cables.findPositionOnCable(selectedCable, event).then(function(r) {
					if (r.positioning == "begin") {
						dataMerge.position = 1;
					}
					if (r.positioning == "end") {
						dataMerge.position = 3;
					}
					if (r.positioning == "middle") {
						dataMerge.position = 2;
					}
					$rootScope.Cables.merge_with_ap(dataMerge);
					stop = true;
				});
			}
			if (selectedCable.category == 2 && (selectedAccessPoint.category == 4 || selectedAccessPoint.category == 5)) {
				//CONECTANDO UM CABO UTP (2) A UMA CAIXA DE EMENDA OU ATENDIMENT (4 OU 5)
				var options = {
					autoOpen: false,
					modal: true,
					title: $rootScope.Users.translateText("Atenção"),
					width: 300,
					height: "auto",
					resizable: true,
					dialogClass: "noclose alertModal",
				};
				$rootScope.messageAlert = $rootScope.Users.translateText("Voce não pode adicionar um cabo UTP a uma caixa de emenda ou atendimento. O cabo será movido mas não será vinculado");
				model = [];
				$rootScope.dialogService.open("alertModal", "alertModal", model, options).then();
				return;
			} else if (selectedCable.category == 2) {
				//CONECTANDO UM CABO UTP (1) A UMA PAC (3)
				$rootScope.Cables.findPositionOnCable(selectedCable, event).then(function(r) {
					// $rootScope.Cables.positionOnCable = r;
					// $rootScope.Cables.cableSelected = cable;

					if (r.positioning == "begin") {
						dataMerge.position = 1;
					}
					if (r.positioning == "end") {
						dataMerge.position = 3;
					}
					if (r.positioning == "middle") {
						dataMerge.position = 2;
					}
					$rootScope.Cables.merge_with_ap(dataMerge);
				});

			}

			//atualizar o pondo do cabo
			$.ajax({
				url: $rootScope.base_url + "/cables/edit",
				type: "POST",
				data: data,
				success: function(data) {
					if (data.status == 0) {
						$rootScope.set_message(data);
					}
					$rootScope.$digest();
				},
			})

		},

		generateGoogleMapsLink: function(event) {
			console.log("generateGoogleMapsLink");

			var lat = $rootScope.event.latLng.lat();
			var lng = $rootScope.event.latLng.lng();

			console.log("lat", lat);
			console.log("lng", lng);

			// Generate link
			var gMapsLink = "http://maps.google.com/maps?q=" + lat + "," + lng;
			console.log("link:", gMapsLink);

			// Open modal with copyable link
			self.openCopyLinkModal("Copie o link abaixo para abrir esta localização no Google Maps", gMapsLink);
		},

		openCopyLinkModal: function(message, link) {
			self.copyLinkMessage = message;
			self.copyLink = link;

			var options = {
				autoOpen: false,
				modal: true,
				title: $rootScope.Users.translateText("Copiar Link"),
				width: 500,
				height: "auto",
				resizable: false,
				close: function() {
					self.copyLinkMessage = null;
					self.copyLink = null;
				}
			};
			$rootScope.dialogService.open("copyLinkDialog", "copyLinkDialog", [], options).then((a) => {
				console.log("THEN AFTER OPEN", a);
			});
		},

		copyToClipboard: function(text) {
			// Get the text field
			var copyText = document.getElementById("copy-link-input");

			// Select the text field
			copyText.select();
			copyText.setSelectionRange(0, 99999); // For mobile devices

			// Copy the text inside the text field
			navigator.clipboard.writeText(copyText.value);

			// Alert the copied text
			var msg = $rootScope.Users.translateText("Copiado para área de transferência");
			// alert(msg);
			console.log(msg);
		},
	};

	document.documentElement.lastElementChild.oncontextmenu = function() {
		return false;
	};

	return self;
});
