app.service('RegionReports', function($rootScope, Map,Projects,dialogService,$timeout, $q){
	
	var self = {
		
		//------------------------------------------------------------//
		// RELATORIO DE CUSTO
		//------------------------------------------------------------//
			
		regionCostReport : function(parent_id){
			//Send event to analytics
			// if ($rootScope.run_analytics) {
			// 	ga("send", {
			// 		hitType: "event",
			// 		eventCategory: "RegionReports",
			// 		eventAction: "Get Region Cost Report",
			// 		eventLabel: "Cost Report"
			// 	});
			// }

			$rootScope.accessPointTypes = [
				{ id: 5, label: 'Caixas de atendimento' },
				{ id: 4, label: 'Caixas de emenda' },
				{ id: 3, label: 'PACs' },
				{ id: 2, label: 'Armarios' },
				{ id: 1, label: 'Fontes' }
			];
	
			$rootScope.cableTypes = [
				{ id: 1, label: 'Cabos de fibra' },
				{ id: 2, label: 'Cabos UTP' },
				{ id: 3, label: 'Cordoalhas' },
				{ id: 4, label: 'Drops' }
			];

			$rootScope.cost_report = [];

			//OPEN MODAL
			var options = {
				autoOpen: false,
				modal: false,
				title: $rootScope.Users.translateText('Relatório de Custo'),
				width: 800,
				height:'auto',
				maxHeight: 600,
				resizable:false,
				dialogClass: "noclose",
				close:function(){
					$rootScope.cost_report = [];    
				}
			};
			model = [];
			$rootScope.dotsCounter = $rootScope.dotsCount;
			dialogService.open('regionCostReportModal','regionCostReportModal', model, options).then();
			
            //montar array com itens da pasta
			if(parent_id){

				self.getRegionCostReport(true,parent_id);
			
			}else if($rootScope.shapeTemp){

				// Extrair os pontos do primeiro array interno
				var rawLatLngs = $rootScope.shapeTemp.latLngs.getAt(0); // ou [0] se for array padrão
				var pathCoordinates = [];

				for (var i = 0; i < rawLatLngs.getLength(); i++) {
				    var latLng = rawLatLngs.getAt(i);
				    pathCoordinates.push(latLng.lng() + ' ' + latLng.lat());
				}
				
				// Fechar o polígono (último ponto igual ao primeiro)
				if (pathCoordinates.length > 0 && pathCoordinates[0] !== pathCoordinates[pathCoordinates.length - 1]) {
				    pathCoordinates.push(pathCoordinates[0]);
				}
				
				var polygonWKT = 'POLYGON((' + pathCoordinates.join(', ') + '))';
				
				// Buscar todas as conexões de access points de uma vez para evitar múltiplas requisições AJAX
				var apConnectionsCache = {};
				var allConnections = $rootScope.Connections.list_all_connections();
				if(allConnections){
					angular.forEach(allConnections, function(conn){
						if(conn && conn.access_point_id && conn.cable_id){
							var key = conn.access_point_id + '_' + conn.cable_id;
							if(!apConnectionsCache[key]){
								apConnectionsCache[key] = [];
							}
							apConnectionsCache[key].push(conn);
						}
					});
				}
				
				// Calcular lengthInside dos cabos no frontend usando anyPointInside
				var cablesLengthInside = {};
				var interval = 10; // mesmo intervalo usado no método anyPointInside
				
				angular.forEach($rootScope.Cables.cables, function(cablesByCategory, categoryIndex){
					if(cablesByCategory){
						angular.forEach(cablesByCategory, function(cable, cableIndex){
							if(cable && cable.polyline && cable.id){
								// Passar returnBaseOnly=true para retornar apenas o comprimento base (sem reservas)
								// As reservas serão adicionadas no backend para manter consistência
								var lengthInside = self.anyPointInside(cable, $rootScope.shapeTemp, interval, false, apConnectionsCache, true);
								if(lengthInside > 0){
									cablesLengthInside[cable.id] = lengthInside;
								}
							}
						});
					}
				});
				
				
				self.getRegionCostReport(false, polygonWKT, cablesLengthInside);
				
			}

			//---------
			self.cost_report_loading = true;
			// $timeout(function(){
			// 	if(parent_id){

			// 		//Send event to analytics
			// 		if ($rootScope.run_analytics){
			// 			ga('send', {
			// 				hitType: 'event',
			// 				eventCategory: 'RegionReports',
			// 				eventAction: 'cost report from treeview',
			// 				eventLabel: 'from treeview'
			// 			});
			// 		}

			// 		self.getRegionCostReport(items);
			// 	}else{

			// 		//Send event to analytics
			// 		if ($rootScope.run_analytics){
			// 			ga('send', {
			// 				hitType: 'event',
			// 				eventCategory: 'RegionReports',
			// 				eventAction: 'cost report from region',
			// 				eventLabel: 'from region'
			// 			});
			// 		}

			// 		self.getRegionCostReport();
			// 	}
			// },100);
		},

		getRegionCostReport : function(isFromTree,data,cablesLengthInside){

			if($rootScope.dotsCount>0){
				angular.forEach($rootScope.dotsTemp,function(val,index){
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
			self.adding = false;
			
			
			link = $rootScope.base_url+'/cost_report/getRegionCostReport'
			var requestData = isFromTree ? {parent_id: data} : {polygon: data};
			if(!isFromTree && cablesLengthInside){
				requestData.cables_length_inside = JSON.stringify(cablesLengthInside);
			}
			
			$.ajax({
				url: link,
				data: requestData,
				type: 'POST',
				success:function(response){
					$rootScope.cost_report = response;
					
					// Setting initial cost type
					self.cost_report_cost_type = "total_cost_current_price";
					self.changeCostType();

					self.cost_report_loading = false;

                	$rootScope.$apply();
					
					
				},
				complete:function(){
				}
			});
		},

		/** Deployed cost is not automatically being parsed by angular.
		 * Using this to set a new variable - total_cost_deployed manually.
		 */
		changeCostType : function(){
			self.cost_report_cost_type_deployed = self.cost_report_cost_type + 'DP';
			$rootScope.cost_report.total_cost_deployed = $rootScope.cost_report[self.cost_report_cost_type_deployed].toFixed(2);
		},

		regionCTOReport : function(parent_id){
			//Send event to analytics
			if ($rootScope.run_analytics) {
				ga("send", {
					hitType: "event",
					eventCategory: "RegionReports",
					eventAction: "Get Region CTO Report",
					eventLabel: "CTO Report"
				});
			}

			//OPEN MODAL
			var options = {
					autoOpen: false,
					modal: false,
					title: $rootScope.Users.translateText('Relatório de CTOs'),
					width: 600,
					height:'auto',
					maxHeight: 600,
					resizable:false,
					dialogClass: "noclose",
					close:function(){
						$rootScope.cto_report = [];    
					}
			};
			model = [];
			$rootScope.dotsCounter = $rootScope.dotsCount;
			dialogService.open('regionCTOReportModal','regionCTOReportModal', model, options).then();
			
            //montar array com itens da pasta
			if(parent_id){

				var items = [],subFolders = [];

				getItems(parent_id);

				function getItems(parent_id){
					$('#jstree-sidebar-div').jstree().get_json('#', {flat:true}).filter(n => n.parent == parent_id).forEach(item =>{
						if(item.data.category !== 1){
							items.push(item.data);
						}else{
							subFolders.push(item);
						}
					});
				}

				subFolders.forEach(folder =>{

					getItems(folder.id);

					subFolders.splice(folder,1);

				});
			}

			//---------
			self.isloading = true;
			$timeout(function(){
				if(parent_id){
					self.getRegionCTOReport(items);
				}else{
					self.getRegionCTOReport();
				}
			},100);
		},

		getRegionCTOReport : function(items){
			$timeout(function(){
				//Initial variables
				//backup do valor de dotsCount
				$rootScope.dotsCount = $rootScope.dotsCounter;
				$rootScope.cto_report = [];
				$rootScope.cto_report.total_ctos = 0;
				$rootScope.cto_report.total_clients_connecteds = 0;
				$rootScope.cto_report.total_avaliable_ports = 0;
				$rootScope.cto_report.total_ctosDP = 0;
				$rootScope.cto_report.total_clients_connectedsDP = 0;

				$rootScope.cto_report.total_ctos_all = 0;
				$rootScope.cto_report.total_clients_connecteds_all = 0;
				
				if ($rootScope.fixed_region_report_flag){
					var report_shape = $rootScope.fixedRegionReportShape;
				} else {
					var report_shape = $rootScope.shapeTemp;
				}

				var setDeployed =  "";
				var array_splitters = [];

				access_point_connections = $rootScope.Connections.list_all_connections();
				
				for (var i = 0; i < $rootScope.AccessPoints.accessPoints[5].length; i++){
					var access_point = $rootScope.AccessPoints.accessPoints[5][i];
					
					//usada pra definir deployed ou não
					setDeployed = access_point.deploy_information.deployed ? "DP":"";

					if ($rootScope.Markers.markerOnMap(access_point.dot)){

						var calculate = false;
						//verificando origem do relatório treeview ou região
						if(!items){
							//get position variable for the Access Point
							ap_position = new google.maps.LatLng(access_point.dot.position.lat(), access_point.dot.position.lng());
							calculate = google.maps.geometry.poly.containsLocation(ap_position, report_shape);
						}else{
							calculate = items.find(i => i.category === 2 && i.tomo_id === access_point.id) ? true : false;
						}

						if(calculate){
							//Quantidade de ctos
							$rootScope.cto_report['total_ctos'+setDeployed] += 1;
							
							//Clients connecteds
							var clients_connecteds = 0;
							if(access_point_connections){

								if(clients_connecteds = access_point_connections.filter(c=>c.access_point_id === access_point.id && c.client_id !== null)){

									$rootScope.cto_report['total_clients_connecteds'+setDeployed] += clients_connecteds.length;
									
								}
								//Monta array com splitters encontrados para depois obter no ajax portas disponíveis
								var splitters = $rootScope.Connections.splitters_in_ap(access_point_connections, access_point.id);
								if (splitters != null){
									for (var spl_idx = 0; spl_idx < splitters.length; spl_idx++){
										var splitter = splitters[spl_idx];

										array_splitters.push(splitter);

									}
								};
								
							}

							
						}
					}
				};

				if(array_splitters){

					var dataSend = JSON.stringify(array_splitters);          
					$.ajax({
						url: $rootScope.base_url+'/access_point_connections/get_splitters_ports_free',
						type: 'POST',
						data: {data:dataSend},
						dataType: "json",
						success:function(data){
							
							$rootScope.cto_report.total_avaliable_ports = data; 

							$rootScope.cto_report.total_ctos_all = $rootScope.cto_report.total_ctos + $rootScope.cto_report.total_ctosDP;
							$rootScope.cto_report.total_clients_connecteds_all = $rootScope.cto_report.total_clients_connecteds + $rootScope.cto_report.total_clients_connectedsDP;

							self.isloading = false;
							
							$rootScope.$apply();
							
						},
						error: function(data){
							$rootScope.message_error_modal = data.message;
							console.log(data);
						},
						complete:function(){
							
							$rootScope.$digest();
						}
					});

				}

				$rootScope.$apply();
			},10);
		},
		
		/**
		 * Any Point Inside
		 * Checks if any point in a cable is inside of a polygon/shape.
		 * 
		 * Kinda slow, I actually wanted to get the intersection, but haven't found documentation for that
		 * */
		anyPointInside : function(cable, shape, interval, reportFromFolder, apConnectionsCache, returnBaseOnly){
			//$timeout(function(){
				distance = parseFloat(Map.calculateLengthObject(cable.polyline.getPath().getArray()));
				length_inside = 0;
				for (i = 0; (i * interval)  < distance; i++) {
					point = cable.polyline.GetPointAtDistance(i * interval);
					point = new google.maps.LatLng(point.lat(), point.lng());
					if (reportFromFolder || google.maps.geometry.poly.containsLocation(point, shape)){
						// Calcular o comprimento real deste intervalo (pode ser menor no último trecho)
						var intervalStart = i * interval;
						var intervalEnd = Math.min((i + 1) * interval, distance);
						var intervalLength = intervalEnd - intervalStart;
						length_inside = length_inside + intervalLength;
					}
				}
				
				// Garantir que lengthInside não ultrapasse o comprimento total
				if(length_inside > distance){
					length_inside = distance;
				}
				
				// Se returnBaseOnly for true, retornar apenas o comprimento base (sem reservas)
				// Isso é usado quando o cálculo é feito no frontend mas as reservas serão adicionadas no backend
				if(returnBaseOnly){
					return length_inside;
				}
				
				//Check reserves also!!
				if (length_inside > 0){
					angular.forEach($rootScope.Reserves.reserves, function(reserve, index_reserve){
						if (reserve.cable_id == cable.id){
							point = new google.maps.LatLng(reserve.dot.position.lat(), reserve.dot.position.lng());
							if (reportFromFolder || google.maps.geometry.poly.containsLocation(point, shape)){
								length_inside = length_inside + reserve.length;
							}
						}
					});
				}
				
				//Check auto-reserves in Caixas de Atendimento:
				if (length_inside > 0){
					//Access points with category = 5 on this cable should add reserves.
					angular.forEach($rootScope.AccessPoints.accessPoints[5], function(ap, ap_index){
						if ($rootScope.Cables.apOnCable(ap, cable)){
							// Usar cache se disponível, senão usar método antigo (com AJAX)
							var isOnEnd = false;
							if(apConnectionsCache){
								var key = ap.id + '_' + cable.id;
								var connections = apConnectionsCache[key];
								if(connections && connections.length === 1){
									isOnEnd = true;
								} else if(connections && connections.length > 1){
									isOnEnd = false;
								}
							} else {
								// Fallback para método antigo se cache não estiver disponível
								isOnEnd = $rootScope.Cables.apOnCableEnd(ap, cable);
							}
							
							if (isOnEnd){
								length_inside = length_inside + $rootScope.DefaultValues.auto_reserve;
							} else {
								length_inside = length_inside + ($rootScope.DefaultValues.auto_reserve * 2);
							}
						}
					});
				}
				return length_inside;
			//},1);
		},
		
		toggleDetails : function(id){
			if (id == 1){
				//Access Points
				if ($rootScope.cost_report.show_access_points_details){
					$rootScope.cost_report.show_access_points_details = false;
				} else {
					$rootScope.cost_report.show_access_points_details = true;
				}
			} else if (id == 2){
				//Splitters
				if ($rootScope.cost_report.show_splitters_details){
					$rootScope.cost_report.show_splitters_details = false;
				} else {
					$rootScope.cost_report.show_splitters_details = true;
				}
			} else if (id == 3){
				//Hosts
				if ($rootScope.cost_report.show_hosts_details){
					$rootScope.cost_report.show_hosts_details = false;
				} else {
					$rootScope.cost_report.show_hosts_details = true;
				}
			} else if (id == 4){
				//Cables
				if ($rootScope.cost_report.show_cables_details){
					$rootScope.cost_report.show_cables_details = false;
				} else {
					$rootScope.cost_report.show_cables_details = true;
				}
			}
		},

		svgToPDF: function() {
			let svgElement = $("#regionCostReport")[0];
		
			html2canvas(svgElement, {
				backgroundColor: '#fff',
				// scale: 2
			}).then(function(canvas) {
				let margin = 40; // margem de 40pt
				let imgWidth = canvas.width;
				let imgHeight = canvas.height;
		
				let pdfWidth = imgWidth + margin * 2;
				let pdfHeight = imgHeight + margin * 2;
		
				let pdf = new jsPDF('p', 'pt', [pdfWidth, pdfHeight]);
		
				pdf.addImage(
					canvas.toDataURL("image/png"),
					"PNG",
					margin, // X
					margin, // Y
					imgWidth, // largura da imagem
					imgHeight, // altura da imagem
					'',
					'FAST'
				);
		
				pdf.save("MAPWISP-RelatorioDeCusto.pdf");
			});
		},		
	
		saveCostReport : function(){
			var first_table_drawn = false;
			
		    var doc = new jsPDF('p', 'pt');
		    
		    var pageY = 60;

		    var currency_symbol = $rootScope.user_data.user_setting.currency_symbol === 1 ? "$ " : "R$ ";

		    doc.setFontSize(18);
		    doc.text($rootScope.Users.translateText("MAPWISP - Relatório de Custo "), 40, pageY);
			pageY = pageY + 30;

			// Mostrar tipo de soma de preços sendo usado
			doc.setFontSize(12);
			var priceTypeText = self.cost_report_cost_type == "total_cost" 
								? "(Usando preço de itens no momento de criação)" 
								: "(Usando preço atual dos tipos de itens)";
			doc.text($rootScope.Users.translateText(priceTypeText), 40, pageY);
			doc.setFontSize(18);
		    	    
		    //################################
			//            Não implantados
			//################################

			pageY = pageY + 50;
					
			doc.text($rootScope.Users.translateText("Itens não implantados"), 250, pageY);

			//Caixas de atendimento
		    if ($rootScope.cost_report.access_points[5][self.cost_report_cost_type] > 0){
		    	//Define starting point in PDF page
		    	//if (!first_table_drawn){
		    	//	pageY = 90;
		    		first_table_drawn = true;
		    	//} else {
		    		pageY = pageY + 30;
		    	//}
		    	//Define table content:
		    	columns = [$rootScope.Users.translateText("Tipo"), $rootScope.Users.translateText("Quantidade"), $rootScope.Users.translateText("Custo Unitario"), $rootScope.Users.translateText("Custo Total")];
		    	rows = [];
		    	angular.forEach($rootScope.cost_report.access_points[5], function(tipo_atendimento, type_index){
		    		if ((tipo_atendimento) && (tipo_atendimento.total_cost > 0)){
			    		row = [];
			    		row.push(tipo_atendimento.name);
			    		row.push(tipo_atendimento.quantity);
			    		row.push(currency_symbol+tipo_atendimento.price);
			    		row.push(currency_symbol+tipo_atendimento[self.cost_report_cost_type].toFixed(2));
			    		rows.push(row);
		    		}
		    	});
		    	rows.push([$rootScope.Users.translateText("Total"), currency_symbol+$rootScope.cost_report.access_points[5][self.cost_report_cost_type].toFixed(2)]);
		    	//Draw Table
			    doc.text($rootScope.Users.translateText("Caixas de atendimento"), 40, pageY);
			    doc.autoTable(columns, rows, {
			        startY: pageY + 10,
			        pageBreak: 'avoid',
			    });
			}
						
			//Splitters Balanceados
		    if ($rootScope.cost_report.splitters.total_quantity_balanceados > 0){
		    	//Define starting point in PDF page
		    	if (!first_table_drawn){
		    		pageY = pageY + 30;
		    		first_table_drawn = true;
		    	} else {
		    		pageY = doc.autoTableEndPosY() + 30;
		    	}
		    	//Define table content:
		    	columns = [$rootScope.Users.translateText("Portas"), $rootScope.Users.translateText("Quantidade")];
		    	rows = [];
		    	angular.forEach($rootScope.cost_report.splitters, function(tipo_splitter, type_index){
		    		if ((tipo_splitter) && (tipo_splitter.quantity > 0)){
			    		row = [];
			    		row.push(tipo_splitter.ports);
			    		row.push(tipo_splitter.quantity);
			    		rows.push(row);
		    		}
		    	});
			    doc.text($rootScope.Users.translateText("Splitters Balanceados"), 40, pageY);
			    doc.autoTable(columns, rows, {
			        startY: pageY + 10,
			        pageBreak: 'avoid',
			    });
			}
			//tipo_splitter in cost_report.splitters.desbalanceados track by $index
			//Splitters Desbalanceados
		    if ($rootScope.cost_report.splitters.total_quantity_desbalanceados > 0){
		    	//Define starting point in PDF page
		    	if (!first_table_drawn){
		    		pageY = pageY + 30;
		    		first_table_drawn = true;
		    	} else {
					pageY = doc.autoTableEndPosY() + 30;
				}
				//Define table content:
		    	columns = [$rootScope.Users.translateText("Saida 1"), $rootScope.Users.translateText("Saida 2"), $rootScope.Users.translateText("Quantidade")];
		    	rows = [];
		    	angular.forEach($rootScope.cost_report.splitters.desbalanceados, function(tipo_splitter, type_index){
		    		if ((tipo_splitter) && (tipo_splitter.quantity > 0)){
			    		row = [];
			    		row.push(tipo_splitter.out_one);
						row.push(tipo_splitter.out_two);
						row.push(tipo_splitter.quantity);
			    		rows.push(row);
		    		}
		    	});
			    doc.text($rootScope.Users.translateText("Splitters Desbalanceados"), 40, pageY);
			    doc.autoTable(columns, rows, {
			        startY: pageY + 10,
			        pageBreak: 'avoid',
			    });
		    }

			
		    //Caixas de emenda
		    if ($rootScope.cost_report.access_points[4][self.cost_report_cost_type] > 0){
		    	//Define starting point in PDF page
		    	if (!first_table_drawn){
		    		pageY = pageY + 30;
		    		first_table_drawn = true;
		    	} else {
		    		pageY = doc.autoTableEndPosY() + 30;
		    	}
		    	//Define table content:
		    	columns = [$rootScope.Users.translateText("Tipo"), $rootScope.Users.translateText("Quantidade"), $rootScope.Users.translateText("Custo Unitario"), $rootScope.Users.translateText("Custo Total")];
		    	rows = [];
		    	angular.forEach($rootScope.cost_report.access_points[4], function(tipo_atendimento, type_index){
		    		if ((tipo_atendimento) && (tipo_atendimento[self.cost_report_cost_type] > 0)){
			    		row = [];
			    		row.push(tipo_atendimento.name);
			    		row.push(tipo_atendimento.quantity);
			    		row.push(currency_symbol+tipo_atendimento.price.toFixed(2));
			    		row.push(currency_symbol+tipo_atendimento[self.cost_report_cost_type].toFixed(2));
			    		rows.push(row);
		    		}
		    	});
		    	rows.push([$rootScope.Users.translateText("Total"), currency_symbol+$rootScope.cost_report.access_points[4][self.cost_report_cost_type].toFixed(2)]);
			    doc.text($rootScope.Users.translateText("Caixas de emenda"), 40, pageY);
			    doc.autoTable(columns, rows, {
			        startY: pageY + 10,
			        pageBreak: 'avoid',
			    });
		    }
		    
		    //PACs
		    if ($rootScope.cost_report.access_points[3][self.cost_report_cost_type] > 0){
		    	//Define starting point in PDF page
		    	if (!first_table_drawn){
		    		pageY = pageY + 30;
		    		first_table_drawn = true;
		    	} else {
		    		pageY = doc.autoTableEndPosY() + 30;
		    	}
		    	//Define table content:
		    	columns = [$rootScope.Users.translateText("Tipo"), $rootScope.Users.translateText("Quantidade"), $rootScope.Users.translateText("Custo Unitario"), $rootScope.Users.translateText("Custo Total")];
		    	rows = [];
		    	angular.forEach($rootScope.cost_report.access_points[3], function(tipo_atendimento, type_index){
		    		if ((tipo_atendimento) && (tipo_atendimento[self.cost_report_cost_type] > 0)){
			    		row = [];
			    		row.push(tipo_atendimento.name);
			    		row.push(tipo_atendimento.quantity);
			    		row.push(currency_symbol+tipo_atendimento.price);
			    		row.push(currency_symbol+tipo_atendimento[self.cost_report_cost_type].toFixed(2));
			    		rows.push(row);
		    		}
		    	});
		    	rows.push([$rootScope.Users.translateText("Total"), currency_symbol+$rootScope.cost_report.access_points[3][self.cost_report_cost_type].toFixed(2)]);
			    doc.text("PACs", 40, pageY);
			    doc.autoTable(columns, rows, {
			        startY: pageY + 10,
			        pageBreak: 'avoid',
			    });
		    }

		    //Armarios
		    if ($rootScope.cost_report.access_points[2][self.cost_report_cost_type] > 0){
		    	//Define starting point in PDF page
		    	if (!first_table_drawn){
		    		pageY = pageY + 30;
		    		first_table_drawn = true;
		    	} else {
		    		pageY = doc.autoTableEndPosY() + 30;
		    	}
		    	//Define table content:
		    	columns = [$rootScope.Users.translateText("Tipo"), $rootScope.Users.translateText("Quantidade"), $rootScope.Users.translateText("Custo Unitario"), $rootScope.Users.translateText("Custo Total")];
		    	rows = [];
		    	angular.forEach($rootScope.cost_report.access_points[2], function(tipo_atendimento, type_index){
		    		if ((tipo_atendimento) && (tipo_atendimento[self.cost_report_cost_type] > 0)){
			    		row = [];
			    		row.push(tipo_atendimento.name);
			    		row.push(tipo_atendimento.quantity);
			    		row.push(currency_symbol+tipo_atendimento.price);
			    		row.push(currency_symbol+tipo_atendimento[self.cost_report_cost_type].toFixed(2));
			    		rows.push(row);
		    		}
		    	});
		    	rows.push([$rootScope.Users.translateText("Total"), currency_symbol+$rootScope.cost_report.access_points[2][self.cost_report_cost_type].toFixed(2)]);
			    doc.text("Armarios", 40, pageY);
			    doc.autoTable(columns, rows, {
			        startY: pageY + 10,
			        pageBreak: 'avoid',
			    });
		    }

			//Ativos
		    if ($rootScope.cost_report.hosts[self.cost_report_cost_type] > 0){

		    	//Define starting point in PDF page
		    	if (!first_table_drawn){
		    		pageY = pageY + 30;
		    		first_table_drawn = true;
		    	} else {
		    		pageY = doc.autoTableEndPosY() + 30;
		    	}

		    	//Define table content:
		    	columns = [$rootScope.Users.translateText("Tipo"),$rootScope.Users.translateText("Portas"), $rootScope.Users.translateText("Quantidade"), $rootScope.Users.translateText("Custo Unitario"), $rootScope.Users.translateText("Custo Total")];
		    	rows = [];
		    	for (let key in $rootScope.cost_report.hosts) {
				    const host = $rootScope.cost_report.hosts[key];
				    if (host && host.cost > 0) {
				        let row = [];
				        row.push(host.typeName);
				        row.push(host.numPorts);
				        row.push(host.quantity);
				        row.push(currency_symbol + host.price);
				        row.push(currency_symbol + host.cost.toFixed(2));
				        rows.push(row);
				    }
				}

		    	rows.push([$rootScope.Users.translateText("Total"), currency_symbol+$rootScope.cost_report.hosts[self.cost_report_cost_type].toFixed(2)]);
		    	//Draw Table
			    doc.text($rootScope.Users.translateText("Ativos"), 40, pageY);
			    doc.autoTable(columns, rows, {
			        startY: pageY + 10,
			        pageBreak: 'avoid',
			    });
			}
		    
		    //Fontes
		    if ($rootScope.cost_report.access_points[1][self.cost_report_cost_type] > 0){
		    	//Define starting point in PDF page
		    	if (!first_table_drawn){
		    		pageY = pageY + 30;
		    		first_table_drawn = true;
		    	} else {
		    		pageY = doc.autoTableEndPosY() + 30;
		    	}
		    	//Define table content:
		    	columns = [$rootScope.Users.translateText("Tipo"), $rootScope.Users.translateText("Quantidade"), $rootScope.Users.translateText("Custo Unitario"), $rootScope.Users.translateText("Custo Total")];
		    	rows = [];
		    	angular.forEach($rootScope.cost_report.access_points[1], function(tipo_atendimento, type_index){
		    		if ((tipo_atendimento) && (tipo_atendimento[self.cost_report_cost_type] > 0)){
			    		row = [];
			    		row.push(tipo_atendimento.name);
			    		row.push(tipo_atendimento.quantity);
			    		row.push(currency_symbol+tipo_atendimento.price);
			    		row.push(currency_symbol+tipo_atendimento[self.cost_report_cost_type].toFixed(2));
			    		rows.push(row);
		    		}
		    	});
		    	rows.push([$rootScope.Users.translateText("Total"), currency_symbol+$rootScope.cost_report.access_points[1][self.cost_report_cost_type].toFixed(2)]);
			    doc.text("Fontes", 40, pageY);
			    doc.autoTable(columns, rows, {
			        startY: pageY + 10,
			        pageBreak: 'avoid',
			    });
		    }

		    //Cabos de Fibra
		    if ($rootScope.cost_report.cables[1][self.cost_report_cost_type] > 0){
		    	//Define starting point in PDF page
		    	if (!first_table_drawn){
		    		pageY = pageY + 30;
		    		first_table_drawn = true;
		    	} else {
		    		pageY = doc.autoTableEndPosY() + 30;
		    	}
		    	//Define table content:
		    	columns = [$rootScope.Users.translateText("Tipo"), $rootScope.Users.translateText("Comprimento Total"), $rootScope.Users.translateText("Custo por Metro"), $rootScope.Users.translateText("Custo Total")];
		    	rows = [];
		    	angular.forEach($rootScope.cost_report.cables[1], function(tipo_cabo, type_index){
		    		if ((tipo_cabo) && (tipo_cabo[self.cost_report_cost_type] > 0)){
			    		row = [];
			    		row.push(tipo_cabo.name);
			    		row.push(tipo_cabo.length_inside);
			    		row.push(currency_symbol+tipo_cabo.price);
			    		row.push(currency_symbol+tipo_cabo[self.cost_report_cost_type].toFixed(2));
			    		rows.push(row);
		    		}
		    	});
		    	rows.push([$rootScope.Users.translateText("Total"), currency_symbol+$rootScope.cost_report.cables[1][self.cost_report_cost_type].toFixed(2)]);
		    	//Draw table
			    doc.text($rootScope.Users.translateText("Cabos de Fibra"), 40, pageY);
			    doc.autoTable(columns, rows, {
			        startY: pageY + 10,
			        pageBreak: 'avoid',
			    });
		    }
		    
		    //Cabos UTP
		    if ($rootScope.cost_report.cables[2][self.cost_report_cost_type] > 0){
		    	//Define starting point in PDF page
		    	if (!first_table_drawn){
		    		pageY = pageY + 30;
		    		first_table_drawn = true;
		    	} else {
		    		pageY = doc.autoTableEndPosY() + 30;
		    	}
		    	//Define table content:
		    	columns = [$rootScope.Users.translateText("Tipo"), $rootScope.Users.translateText("Comprimento Total"), $rootScope.Users.translateText("Custo por Metro"), $rootScope.Users.translateText("Custo Total")];
		    	rows = [];
		    	angular.forEach($rootScope.cost_report.cables[2], function(tipo_cabo, type_index){
		    		if ((tipo_cabo) && (tipo_cabo[self.cost_report_cost_type] > 0)){
			    		row = [];
			    		row.push(tipo_cabo.name);
			    		row.push(tipo_cabo.length_inside);
			    		row.push(currency_symbol+tipo_cabo.price);
			    		row.push(currency_symbol+tipo_cabo[self.cost_report_cost_type].toFixed(2));
			    		rows.push(row);
		    		}
		    	});
		    	rows.push([$rootScope.Users.translateText("Total"), currency_symbol+$rootScope.cost_report.cables[2][self.cost_report_cost_type].toFixed(2)]);
		    	//Draw table
			    doc.text($rootScope.Users.translateText("Cabos UTP"), 40, pageY);
			    doc.autoTable(columns, rows, {
			        startY: pageY + 10,
			        pageBreak: 'avoid',
			    });
		    }
		    
		    //Cordoalhas
		    if ($rootScope.cost_report.cables[3][self.cost_report_cost_type] > 0){
		    	//Define starting point in PDF page
		    	if (!first_table_drawn){
		    		pageY = pageY + 30;
		    		first_table_drawn = true;
		    	} else {
		    		pageY = doc.autoTableEndPosY() + 30;
		    	}
		    	//Define table content:
		    	columns = [$rootScope.Users.translateText("Tipo"), $rootScope.Users.translateText("Comprimento Total"), $rootScope.Users.translateText("Custo por Metro"), $rootScope.Users.translateText("Custo Total")];
		    	rows = [];
		    	angular.forEach($rootScope.cost_report.cables[3], function(tipo_cabo, type_index){
		    		if ((tipo_cabo) && (tipo_cabo[self.cost_report_cost_type] > 0)){
			    		row = [];
			    		row.push(tipo_cabo.name);
			    		row.push(tipo_cabo.length_inside);
			    		row.push(currency_symbol+tipo_cabo.price);
			    		row.push(currency_symbol+tipo_cabo[self.cost_report_cost_type].toFixed(2));
			    		rows.push(row);
		    		}
		    	});
		    	rows.push([$rootScope.Users.translateText("Total"), currency_symbol+$rootScope.cost_report.cables[3][self.cost_report_cost_type].toFixed(2)]);
		    	//Draw table
			    doc.text($rootScope.Users.translateText("Cordoalhas"), 40, pageY);
			    doc.autoTable(columns, rows, {
			        startY: pageY + 10,
			        pageBreak: 'avoid',
			    });
		    }

            if($rootScope.cost_report.posts && $rootScope.cost_report.posts.quantity > 0){
                if (!first_table_drawn){
		    		pageY = pageY + 30;
		    	} else {
		    		pageY = doc.autoTableEndPosY() + 30;
		    	}
                doc.text($rootScope.Users.translateText("Postes"), 40, pageY);
                doc.setFontSize(12);
                doc.text($rootScope.Users.translateText("Quantidade de postes") + ": " + $rootScope.cost_report.posts.quantity, 40, pageY+30);
                doc.text($rootScope.Users.translateText("Preço total de postes") + ": " + $rootScope.cost_report.posts.total_post_cost, 40, pageY + 60);
                doc.text($rootScope.Users.translateText("Preço mensal de postes") + ": " + $rootScope.cost_report.posts.total_post_month_cost, 40, pageY + 90);
                doc.setFontSize(18);
                pageY = pageY + 120;
            }

            // Ferragens Uneployed
            if($rootScope.cost_report.posts && $rootScope.cost_report.posts.material.length > 0){
                //Define starting point in PDF page
		        pageY = pageY + 30;

                //Define table content:
		    	columns = [$rootScope.Users.translateText("Tipo"), $rootScope.Users.translateText("Quantidade"), $rootScope.Users.translateText("Preço")];
		    	rows = [];
		    	angular.forEach($rootScope.cost_report.posts.material, function(tipo_ferragem, type_index){
		    		if ((tipo_ferragem)){
			    		row = [];
			    		row.push(tipo_ferragem.name);
			    		row.push(tipo_ferragem.quantity);
			    		row.push(tipo_ferragem.price);
			    		rows.push(row);
		    		}
		    	});
                rows.push([$rootScope.Users.translateText("Total"), $rootScope.cost_report.posts.material.reduce((a,b) => {return (a.price * a.quantity) + (b.price * b.quantity)})]);
                //Draw table
			    doc.text($rootScope.Users.translateText("Ferragens em postes"), 40, pageY);
			    doc.autoTable(columns, rows, {
			        startY: pageY + 10,
			        pageBreak: 'avoid',
			    });
            }

			// Update Page Y
			if (!first_table_drawn){
				pageY = pageY + 30;
			} else {
				pageY = doc.autoTableEndPosY() + 30;
			}

		    doc.setFontSize(18);

			//Fusões
			if($rootScope.cost_report["access_points"].total_fusions > 0){
                doc.text($rootScope.Users.translateText("Quantidade de fusões") + " : " + $rootScope.cost_report["access_points"].total_fusions, 40, pageY);
				pageY = pageY + 30;
			}

			//0,00 ficava sobre o custo total
			if($rootScope.cost_report[self.cost_report_cost_type] > 0){
                pageY = pageY + 30;
                doc.text($rootScope.Users.translateText("CUSTO TOTAL: "+currency_symbol)+$rootScope.cost_report[self.cost_report_cost_type].toFixed(2), 40, pageY);
			}

		    //################################
			//           Implantados
			//################################

			pageY = pageY + 60;

		    doc.text($rootScope.Users.translateText("Itens implantados"), 250, pageY);
            var first_table_drawn_dp = false;
		    
		    //Caixas de atendimento
		    if ($rootScope.cost_report.access_pointsDP[5][self.cost_report_cost_type] > 0){
		    	//Define starting point in PDF page
		    	if (!first_table_drawn_dp){
		    		pageY = pageY + 30;
		    		first_table_drawn_dp = true;
		    	} else {
		    		pageY = pageY + 30;
		    	}
		    	//Define table content:
		    	columns = [$rootScope.Users.translateText("Tipo"), $rootScope.Users.translateText("Quantidade"), $rootScope.Users.translateText("Custo Unitario"), $rootScope.Users.translateText("Custo Total")];
		    	rows = [];
		    	angular.forEach($rootScope.cost_report.access_pointsDP[5], function(tipo_atendimento, type_index){
		    		if ((tipo_atendimento) && (tipo_atendimento[self.cost_report_cost_type] > 0)){
			    		row = [];
			    		row.push(tipo_atendimento.name);
			    		row.push(tipo_atendimento.quantity);
			    		row.push(currency_symbol+tipo_atendimento.price);
			    		row.push(currency_symbol+tipo_atendimento[self.cost_report_cost_type].toFixed(2));
			    		rows.push(row);
		    		}
		    	});
		    	rows.push([$rootScope.Users.translateText("Total"), currency_symbol+$rootScope.cost_report.access_pointsDP[5][self.cost_report_cost_type].toFixed(2)]);
		    	//Draw Table
			    doc.text($rootScope.Users.translateText("Caixas de atendimento"), 40, pageY);
			    doc.autoTable(columns, rows, {
			        startY: pageY + 10,
			        pageBreak: 'avoid',
			    });
			}
						
			//Splitters Balanceados
		    if ($rootScope.cost_report.splittersDP.total_quantity_balanceados > 0){
		    	//Define starting point in PDF page
		    	if (!first_table_drawn_dp){
		    		pageY = pageY + 30;
		    		first_table_drawn_dp = true;
		    	} else {
		    		pageY = doc.autoTableEndPosY() + 30;
		    	}
		    	//Define table content:
		    	columns = [$rootScope.Users.translateText("Portas"), $rootScope.Users.translateText("Quantidade")];
		    	rows = [];
		    	angular.forEach($rootScope.cost_report.splittersDP, function(tipo_splitter, type_index){
		    		if ((tipo_splitter) && (tipo_splitter.quantity > 0)){
			    		row = [];
			    		row.push(tipo_splitter.ports);
			    		row.push(tipo_splitter.quantity);
			    		rows.push(row);
		    		}
		    	});
			    doc.text($rootScope.Users.translateText("Splitters Balanceados"), 40, pageY);
			    doc.autoTable(columns, rows, {
			        startY: pageY + 10,
			        pageBreak: 'avoid',
			    });
			}
			//tipo_splitter in cost_report.splitters.desbalanceados track by $index
			//Splitters Desbalanceados
		    if ($rootScope.cost_report.splittersDP.total_quantity_desbalanceados > 0){
		    	//Define starting point in PDF page
		    	if (!first_table_drawn_dp){
		    		pageY = pageY + 30;
		    		first_table_drawn_dp = true;
		    	} else {
					pageY = doc.autoTableEndPosY() + 30;
				}
				//Define table content:
		    	columns = [$rootScope.Users.translateText("Saida 1"), $rootScope.Users.translateText("Saida 2"), $rootScope.Users.translateText("Quantidade")];
		    	rows = [];
		    	angular.forEach($rootScope.cost_report.splittersDP.desbalanceados, function(tipo_splitter, type_index){
		    		if ((tipo_splitter) && (tipo_splitter.quantity > 0)){
			    		row = [];
			    		row.push(tipo_splitter.out_one);
						row.push(tipo_splitter.out_two);
						row.push(tipo_splitter.quantity);
			    		rows.push(row);
		    		}
		    	});
			    doc.text($rootScope.Users.translateText("Splitters Desbalanceados"), 40, pageY);
			    doc.autoTable(columns, rows, {
			        startY: pageY + 10,
			        pageBreak: 'avoid',
			    });
		    }

			
		    //Caixas de emenda
		    if ($rootScope.cost_report.access_pointsDP[4][self.cost_report_cost_type] > 0){
		    	//Define starting point in PDF page
		    	if (!first_table_drawn_dp){
		    		pageY = pageY + 30;
		    		first_table_drawn_dp = true;
		    	} else {
		    		pageY = doc.autoTableEndPosY() + 30;
		    	}
		    	//Define table content:
		    	columns = [$rootScope.Users.translateText("Tipo"), $rootScope.Users.translateText("Quantidade"), $rootScope.Users.translateText("Custo Unitario"), $rootScope.Users.translateText("Custo Total")];
		    	rows = [];
		    	angular.forEach($rootScope.cost_report.access_pointsDP[4], function(tipo_atendimento, type_index){
		    		if ((tipo_atendimento) && (tipo_atendimento[self.cost_report_cost_type] > 0)){
			    		row = [];
			    		row.push(tipo_atendimento.name);
			    		row.push(tipo_atendimento.quantity);
			    		row.push(currency_symbol+tipo_atendimento.price.toFixed(2));
			    		row.push(currency_symbol+tipo_atendimento[self.cost_report_cost_type].toFixed(2));
			    		rows.push(row);
		    		}
		    	});
		    	rows.push([$rootScope.Users.translateText("Total"), currency_symbol+$rootScope.cost_report.access_pointsDP[4][self.cost_report_cost_type].toFixed(2)]);
			    doc.text($rootScope.Users.translateText("Caixas de emenda"), 40, pageY);
			    doc.autoTable(columns, rows, {
			        startY: pageY + 10,
			        pageBreak: 'avoid',
			    });
		    }
		    
		    //PACs
		    if ($rootScope.cost_report.access_pointsDP[3][self.cost_report_cost_type] > 0){
		    	//Define starting point in PDF page
		    	if (!first_table_drawn_dp){
		    		pageY = pageY + 30;
		    		first_table_drawn_dp = true;
		    	} else {
		    		pageY = doc.autoTableEndPosY() + 30;
		    	}
		    	//Define table content:
		    	columns = [$rootScope.Users.translateText("Tipo"), $rootScope.Users.translateText("Quantidade"), $rootScope.Users.translateText("Custo Unitario"), $rootScope.Users.translateText("Custo Total")];
		    	rows = [];
		    	angular.forEach($rootScope.cost_report.access_pointsDP[3], function(tipo_atendimento, type_index){
		    		if ((tipo_atendimento) && (tipo_atendimento[self.cost_report_cost_type] > 0)){
			    		row = [];
			    		row.push($rootScope.AccessPoints.accessPointTypes[tipo_atendimento.type_index].name);
			    		row.push(tipo_atendimento.quantity);
			    		row.push(currency_symbol+$rootScope.AccessPoints.accessPointTypes[tipo_atendimento.type_index].price);
			    		row.push(currency_symbol+tipo_atendimento[self.cost_report_cost_type].toFixed(2));
			    		rows.push(row);
		    		}
		    	});
		    	rows.push([$rootScope.Users.translateText("Total"), currency_symbol+$rootScope.cost_report.access_pointsDP[3][self.cost_report_cost_type].toFixed(2)]);
			    doc.text("PACs", 40, pageY);
			    doc.autoTable(columns, rows, {
			        startY: pageY + 10,
			        pageBreak: 'avoid',
			    });
		    }

		    //Armarios
		    if ($rootScope.cost_report.access_pointsDP[2][self.cost_report_cost_type] > 0){
		    	//Define starting point in PDF page
		    	if (!first_table_drawn_dp){
		    		pageY = pageY + 30;
		    		first_table_drawn_dp = true;
		    	} else {
		    		pageY = doc.autoTableEndPosY() + 30;
		    	}
		    	//Define table content:
		    	columns = [$rootScope.Users.translateText("Tipo"), $rootScope.Users.translateText("Quantidade"), $rootScope.Users.translateText("Custo Unitario"), $rootScope.Users.translateText("Custo Total")];
		    	rows = [];
		    	angular.forEach($rootScope.cost_report.access_pointsDP[2], function(tipo_atendimento, type_index){
		    		if ((tipo_atendimento) && (tipo_atendimento[self.cost_report_cost_type] > 0)){
			    		row = [];
			    		row.push($rootScope.AccessPoints.accessPointTypes[tipo_atendimento.type_index].name);
			    		row.push(tipo_atendimento.quantity);
			    		row.push(currency_symbol+$rootScope.AccessPoints.accessPointTypes[tipo_atendimento.type_index].price);
			    		row.push(currency_symbol+tipo_atendimento[self.cost_report_cost_type].toFixed(2));
			    		rows.push(row);
		    		}
		    	});
		    	rows.push([$rootScope.Users.translateText("Total"), currency_symbol+$rootScope.cost_report.access_pointsDP[2][self.cost_report_cost_type].toFixed(2)]);
			    doc.text($rootScope.Users.translateText("Armários"), 40, pageY);
			    doc.autoTable(columns, rows, {
			        startY: pageY + 10,
			        pageBreak: 'avoid',
			    });
		    }

			//Ativos
		    if ($rootScope.cost_report.hostsDP[self.cost_report_cost_type] > 0){

		    	//Define starting point in PDF page
		    	if (!first_table_drawn_dp){
		    		pageY = pageY + 30;
		    		first_table_drawn_dp = true;
		    	} else {
		    		pageY = doc.autoTableEndPosY() + 30;
		    	}

		    	//Define table content:
		    	columns = [$rootScope.Users.translateText("Tipo"),$rootScope.Users.translateText("Portas"), $rootScope.Users.translateText("Quantidade"), $rootScope.Users.translateText("Custo Unitario"), $rootScope.Users.translateText("Custo Total")];
		    	rows = [];
		    	$rootScope.cost_report.hostsDP.forEach(host =>{
		    		if ((host) && (host.cost > 0)){
			    		row = [];
			    		row.push(host.typeName);
			    		row.push(host.numPorts);
			    		row.push(host.quantity);
			    		row.push(currency_symbol+host.price);
			    		row.push(currency_symbol+host.cost.toFixed(2));
			    		rows.push(row);
		    		}
		    	});
		    	rows.push([$rootScope.Users.translateText("Total"), currency_symbol+$rootScope.cost_report.hostsDP[self.cost_report_cost_type].toFixed(2)]);
		    	//Draw Table
			    doc.text($rootScope.Users.translateText("Ativos"), 40, pageY);
			    doc.autoTable(columns, rows, {
			        startY: pageY + 10,
			        pageBreak: 'avoid',
			    });
			}
		    
		    //Fontes
		    if ($rootScope.cost_report.access_pointsDP[1][self.cost_report_cost_type] > 0){
		    	//Define starting point in PDF page
		    	if (!first_table_drawn_dp){
		    		pageY = pageY + 30;
		    		first_table_drawn_dp = true;
		    	} else {
		    		pageY = doc.autoTableEndPosY() + 30;
		    	}
		    	//Define table content:
		    	columns = [$rootScope.Users.translateText("Tipo"), $rootScope.Users.translateText("Quantidade"), $rootScope.Users.translateText("Custo Unitario"), $rootScope.Users.translateText("Custo Total")];
		    	rows = [];
		    	angular.forEach($rootScope.cost_report.access_pointsDP[1], function(tipo_atendimento, type_index){
		    		if ((tipo_atendimento) && (tipo_atendimento[self.cost_report_cost_type] > 0)){
			    		row = [];
			    		row.push($rootScope.AccessPoints.accessPointTypes[tipo_atendimento.type_index].name);
			    		row.push(tipo_atendimento.quantity);
			    		row.push(currency_symbol+$rootScope.AccessPoints.accessPointTypes[tipo_atendimento.type_index].price);
			    		row.push(currency_symbol+tipo_atendimento[self.cost_report_cost_type].toFixed(2));
			    		rows.push(row);
		    		}
		    	});
		    	rows.push([$rootScope.Users.translateText("Total"), currency_symbol+$rootScope.cost_report.access_pointsDP[1][self.cost_report_cost_type].toFixed(2)]);
			    doc.text($rootScope.Users.translateText("Fontes"), 40, pageY);
			    doc.autoTable(columns, rows, {
			        startY: pageY + 10,
			        pageBreak: 'avoid',
			    });
		    }

		    //Cabos de Fibra
		    if ($rootScope.cost_report.cablesDP[1][self.cost_report_cost_type] > 0){
		    	//Define starting point in PDF page
		    	if (!first_table_drawn_dp){
		    		pageY = pageY + 30;
		    		first_table_drawn_dp = true;
		    	} else {
		    		pageY = doc.autoTableEndPosY() + 30;
		    	}
		    	//Define table content:
		    	columns = [$rootScope.Users.translateText("Tipo"), $rootScope.Users.translateText("Comprimento Total"), $rootScope.Users.translateText("Custo por Metro"), $rootScope.Users.translateText("Custo Total")];
		    	rows = [];
		    	angular.forEach($rootScope.cost_report.cablesDP[1], function(tipo_cabo, type_index){
		    		if ((tipo_cabo) && (tipo_cabo[self.cost_report_cost_type] > 0)){
			    		row = [];
			    		row.push($rootScope.Cables.cableTypes[tipo_cabo.cat_index][tipo_cabo.type_index].name);
			    		row.push(tipo_cabo.length_inside);
			    		row.push(currency_symbol+$rootScope.Cables.cableTypes[tipo_cabo.cat_index][tipo_cabo.type_index].price);
			    		row.push(currency_symbol+tipo_cabo[self.cost_report_cost_type].toFixed(2));
			    		rows.push(row);
		    		}
		    	});
		    	rows.push([$rootScope.Users.translateText("Total"), currency_symbol+$rootScope.cost_report.cablesDP[1][self.cost_report_cost_type].toFixed(2)]);
		    	//Draw table
			    doc.text($rootScope.Users.translateText("Cabos de Fibra"), 40, pageY);
			    doc.autoTable(columns, rows, {
			        startY: pageY + 10,
			        pageBreak: 'avoid',
			    });
		    }
		    
		    //Cabos UTP
		    if ($rootScope.cost_report.cablesDP[2][self.cost_report_cost_type] > 0){
		    	//Define starting point in PDF page
		    	if (!first_table_drawn_dp){
		    		pageY = pageY + 30;
		    		first_table_drawn_dp = true;
		    	} else {
		    		pageY = doc.autoTableEndPosY() + 30;
		    	}
		    	//Define table content:
		    	columns = [$rootScope.Users.translateText("Tipo"), $rootScope.Users.translateText("Comprimento Total"), $rootScope.Users.translateText("Custo por Metro"), $rootScope.Users.translateText("Custo Total")];
		    	rows = [];
		    	angular.forEach($rootScope.cost_report.cablesDP[2], function(tipo_cabo, type_index){
		    		if ((tipo_cabo) && (tipo_cabo[self.cost_report_cost_type] > 0)){
			    		row = [];
			    		row.push($rootScope.Cables.cableTypes[tipo_cabo.cat_index][tipo_cabo.type_index].name);
			    		row.push(tipo_cabo.length_inside);
			    		row.push(currency_symbol+$rootScope.Cables.cableTypes[tipo_cabo.cat_index][tipo_cabo.type_index].price);
			    		row.push(currency_symbol+tipo_cabo[self.cost_report_cost_type].toFixed(2));
			    		rows.push(row);
		    		}
		    	});
		    	rows.push([$rootScope.Users.translateText("Total"), currency_symbol+$rootScope.cost_report.cablesDP[2][self.cost_report_cost_type].toFixed(2)]);
		    	//Draw table
			    doc.text($rootScope.Users.translateText("Cabos UTP"), 40, pageY);
			    doc.autoTable(columns, rows, {
			        startY: pageY + 10,
			        pageBreak: 'avoid',
			    });
		    }
		    
		    //Cordoalhas
		    if ($rootScope.cost_report.cablesDP[3][self.cost_report_cost_type] > 0){
		    	//Define starting point in PDF page
		    	if (!first_table_drawn_dp){
		    		pageY = pageY + 30;
		    		first_table_drawn_dp = true;
		    	} else {
		    		pageY = doc.autoTableEndPosY() + 30;
		    	}
		    	//Define table content:
		    	columns = [$rootScope.Users.translateText("Tipo"), $rootScope.Users.translateText("Comprimento Total"), $rootScope.Users.translateText("Custo por Metro"), $rootScope.Users.translateText("Custo Total")];
		    	rows = [];
		    	angular.forEach($rootScope.cost_report.cablesDP[3], function(tipo_cabo, type_index){
		    		if ((tipo_cabo) && (tipo_cabo[self.cost_report_cost_type] > 0)){
			    		row = [];
			    		row.push($rootScope.Cables.cableTypes[tipo_cabo.cat_index][tipo_cabo.type_index].name);
			    		row.push(tipo_cabo.length_inside);
			    		row.push(currency_symbol+$rootScope.Cables.cableTypes[tipo_cabo.cat_index][tipo_cabo.type_index].price);
			    		row.push(currency_symbol+tipo_cabo[self.cost_report_cost_type].toFixed(2));
			    		rows.push(row);
		    		}
		    	});
		    	rows.push([$rootScope.Users.translateText("Total"), currency_symbol+$rootScope.cost_report.cablesDP[3][self.cost_report_cost_type].toFixed(2)]);
		    	//Draw table
			    doc.text($rootScope.Users.translateText("Cordoalhas"), 40, pageY);
			    doc.autoTable(columns, rows, {
			        startY: pageY + 10,
			        pageBreak: 'avoid',
			    });
		    }

            if($rootScope.cost_report.postsDP && $rootScope.cost_report.postsDP.quantity > 0){
                if (!first_table_drawn_dp){
		    		pageY = pageY + 30;
		    	} else {
		    		pageY = doc.autoTableEndPosY() + 30;
		    	}
                doc.text($rootScope.Users.translateText("Postes"), 40, pageY);
                doc.setFontSize(12);
                doc.text($rootScope.Users.translateText("Quantidade de postes") + ": " + $rootScope.cost_report.postsDP.quantity, 40, pageY + 30);
                doc.text($rootScope.Users.translateText("Preço total de postes") + ": " + $rootScope.cost_report.postsDP.total_post_cost, 40, pageY + 60);
                doc.text($rootScope.Users.translateText("Preço mensal de postes") + ": " + $rootScope.cost_report.postsDP.total_post_month_cost, 40, pageY + 90);
                doc.setFontSize(18);
                pageY = pageY + 120;
            }

            // Ferragens Deployed
            if($rootScope.cost_report.postsDP.material.length > 0){
                //Define starting point in PDF page
		    	pageY = pageY + 30;

                //Define table content:
		    	columns = [$rootScope.Users.translateText("Tipo"), $rootScope.Users.translateText("Quantidade"), $rootScope.Users.translateText("Preço")];
		    	rows = [];
		    	angular.forEach($rootScope.cost_report.postsDP.material, function(tipo_ferragem, type_index){
		    		if ((tipo_ferragem)){
			    		row = [];
			    		row.push(tipo_ferragem.name);
			    		row.push(tipo_ferragem.quantity);
			    		row.push(tipo_ferragem.price);
			    		rows.push(row);
		    		}
		    	});
                rows.push([$rootScope.Users.translateText("Total"), $rootScope.cost_report.postsDP.material.reduce((a,b) => {return (a.price * a.quantity) + (b.price * b.quantity)})]);
                //Draw table
			    doc.text($rootScope.Users.translateText("Ferragens em postes"), 40, pageY);
			    doc.autoTable(columns, rows, {
			        startY: pageY + 10,
			        pageBreak: 'avoid',
			    });
            }

			// Update Page Y
			if (!first_table_drawn){
				pageY = pageY + 30;
			} else {
				pageY = doc.autoTableEndPosY() + 30;
			}

		    doc.setFontSize(18);
			var cost_report_type = self.cost_report_cost_type + "DP";

			//Fusões
			if($rootScope.cost_report["access_pointsDP"].total_fusions > 0){
                doc.text($rootScope.Users.translateText("Quantidade de fusões") + " : " + $rootScope.cost_report["access_pointsDP"].total_fusions, 40, pageY);
				pageY = pageY + 30;
			}

			//0,00 ficava sobre o valor total
			if($rootScope.cost_report[cost_report_type] > 0){
                pageY = pageY + 30;
                doc.text($rootScope.Users.translateText("CUSTO TOTAL: "+currency_symbol)+$rootScope.cost_report[cost_report_type].toFixed(2), 40, pageY);
			}

		    doc.setFontSize(12);
			
		    doc.save('MAPWISP-RelatorioDeCusto.pdf');
		},
		
		//------------------------------------------------------------//
		// RELATORIO DE ITENS [LISTAGEM DE ITENS]
		//------------------------------------------------------------//
		
		regionItemReport : function(){
			//Send event to analytics
			if ($rootScope.run_analytics) {
				ga("send", {
					hitType: "event",
					eventCategory: "RegionReports",
					eventAction: "Get Region Item Report",
					eventLabel: "Item Report"
				});
			}

			self.accessPointsInItemReport = true;
			self.cablesInItemReport = true;
			self.postsInItemReport = true;
			self.clientsInItemReport = true;

			//OPEN MODAL
			var options = {
					autoOpen: false,
					modal: false,
					title: $rootScope.Users.translateText('Relatório de Itens'),
					width: 600,
					height: 600,
					maxHeight: 300,
					resizable:false,
					dialogClass: "noclose",
					close:function(){
						$rootScope.item_report = [];
					}
			};
			model = [];
			$rootScope.dotsCounter = $rootScope.dotsCount;
			dialogService.open('regionItemReportModalPre','regionItemReportModalPre', model, options).then();
		},
		
		cancelRegionItemReport : function(){
			dialogService.close('regionItemReportModalPre');
			angular.forEach($rootScope.dotsTemp,function(val,index){
				val.setMap(null);
			});
			$rootScope.shapeTemp.setMap(null);
			$rootScope.shapeTemp = [];
			$rootScope.dotsTemp = [];
			$rootScope.tempPath = [];
			$rootScope.dotsCount = 0;
		},
		
		openRegionItemReport : function(){
			dialogService.close('regionItemReportModalPre');
			//OPEN MODAL
			var options = {
					autoOpen: false,
					modal: false,
					title: $rootScope.Users.translateText('Relatório de Itens'),
					width: 600,
					height: 600,
					maxHeight: 600,
					resizable:false,
					dialogClass: "noclose",
					close:function(){
						$rootScope.item_report = [];
						$rootScope.shapeTemp.setMap(null);
						angular.forEach($rootScope.dotsTemp,function(val,index){
							val.setMap(null);
						});
						$rootScope.shapeTemp = [];
						$rootScope.dotsTemp = [];
						$rootScope.tempPath = [];
						$rootScope.dotsCount = 0;
					}
			};
			model = [];
			$rootScope.dotsCounter = $rootScope.dotsCount;
			dialogService.open('regionItemReportModal','regionItemReportModal', model, options).then();
			//---------
			self.item_report_loading = true;
			$timeout(function(){
				self.getRegionItemReport();
			},100);
		},
			
		getRegionItemReport : function(){
			$timeout(function(){
				//Initial variables
				//backup do valor de dotsCount
				$rootScope.dotsCount = $rootScope.dotsCounter;
				$rootScope.item_report = [];
				
				if (!self.accessPointsInItemReport && !self.cablesInItemReport && !self.postsInItemReport && !self.clientsInItemReport){
					self.item_report_loading = false;
					return;
				}
				
				if ($rootScope.fixed_region_report_flag){
					var report_shape = $rootScope.fixedRegionReportShape;
				} else {
					var report_shape = $rootScope.shapeTemp;
				}
				
				
				if (self.accessPointsInItemReport){
					//ACCESS POINTS
					$rootScope.item_report['access_points'] = [];
					angular.forEach($rootScope.AccessPoints.accessPoints, function(ap_type, index_category){
						$rootScope.item_report['access_points'][index_category] = [];
						angular.forEach(ap_type, function(access_point, index_ap){
							if (access_point.dot){
								if (access_point.dot.map){
									//get position variable for the Access Point
									ap_position = new google.maps.LatLng(access_point.dot.position.lat(), access_point.dot.position.lng());
									if(google.maps.geometry.poly.containsLocation(ap_position, report_shape)){
										if (!$rootScope.item_report['access_points'][index_category]){
											$rootScope.item_report['access_points'][index_category] = []
											$rootScope.item_report['access_points'][index_category].push({"type_name" : access_point.access_point_type_name,"name" : access_point.name});
										} else {
											$rootScope.item_report['access_points'][index_category].push({"type_name" : access_point.access_point_type_name,"name" : access_point.name});
											
										}
										$rootScope.$apply();
									}
								}
							}
						});
						/*if (!self.cablesInItemReport){
							self.item_report_loading = false;
						}*/
					});
				}
				
				//CABLES
				if (self.cablesInItemReport){
					$rootScope.item_report['cables'] = [];
					$rootScope.item_report['cables'].total_cable_cost
					access_points_in_region = [];
					angular.forEach($rootScope.Cables.cables, function(cable_category, cat_index){
						$rootScope.item_report['cables'][cat_index] = [];
						angular.forEach(cable_category, function(cable, cable_index){
							$timeout(function(){
								if (cable.polyline.map){
									if (self.anyPointInsideQuick(cable, report_shape, 10)){
										//Get the type name
										var x;
										var y;
										var broke = false;
										for (x = 0; x < $rootScope.Cables.cableTypes.length; x++){
											if ($rootScope.Cables.cableTypes[x]){
												for (y = 0; y < $rootScope.Cables.cableTypes[x].length; y++){
													if ($rootScope.Cables.cableTypes[x][y].id == cable.cable_type_id){
														var type_name = $rootScope.Cables.cableTypes[x][y].name;
														broke = true;
														break;
													}
												}
												if (broke){
													break;
												}
											}
										}
										
										//Push the data to the array
										if (!$rootScope.item_report['cables'][cat_index]){
											$rootScope.item_report['cables'][cat_index] = []
											$rootScope.item_report['cables'][cat_index].push({"type_name" : type_name, "name" : cable.name});											
										} else {
											$rootScope.item_report['cables'][cat_index].push({"type_name" : type_name, "name" : cable.name});
										}

										$rootScope.$apply();
									}
								}
								if ((cable_index == cable_category.length-1) && (cat_index == $rootScope.Cables.cables.length - 1)){
									self.item_report_loading = false;
								}
							},0);
						});
					});
				}

				if (self.postsInItemReport){
					$rootScope.item_report['posts'] = [];
					$rootScope.item_report['posts']['material'] = [];
					var countPost = 0;
					var countMaterial = 0;
					var posts = $rootScope.Posts.posts.filter(obj =>  obj.dot && google.maps.geometry.poly.containsLocation(obj.dot.position, report_shape));
                    for(let post of posts){
					    $rootScope.item_report['posts'][countPost] = [];
						$rootScope.item_report['posts'][countPost].name = post.name;

						
						for (var material of post.material_types){
							
							$rootScope.item_report['posts']['material'][countMaterial] = [];
							$rootScope.item_report['posts']['material'][countMaterial].name = material.name;
							if(isNaN($rootScope.item_report['posts']['material'][countMaterial].quantity)){
								$rootScope.item_report['posts']['material'][countMaterial].quantity = 0;
							}
							$rootScope.item_report['posts']['material'][countMaterial].quantity += material._joinData.quantity;
						    countMaterial++;
						}
						countPost++;
					}

					var result = [];
					$rootScope.item_report['posts']['material'].reduce(function(res, value) {
					  if (!res[value.name]) {
						res[value.name] = { name: value.name, quantity: 0 };
						result.push(res[value.name])
					  }
					  res[value.name].quantity += value.quantity;
					  return res;
					}, {});

					$rootScope.item_report['posts']['material'] = result;
					
					self.item_report_loading = false;
					$rootScope.$apply();
				}
				

				if (self.clientsInItemReport){
					//CLIENTS
					$rootScope.item_report['clients'] = [];
					$rootScope.item_report['clients'].qtd = 0;
					var countClient = 0;
					var clients = $rootScope.Clients.clients.filter(obj =>  obj.marker && google.maps.geometry.poly.containsLocation(obj.marker.position, report_shape));
					for (let client of clients){
						$rootScope.item_report['clients'][countClient] = [];
						$rootScope.item_report['clients'][countClient].name = client.name;

						countClient++;
					}
					self.item_report_loading = false;
					$rootScope.$apply();
				}

				//conta itens nos prédios
				var buildings = $rootScope.Buildings.buildings.filter(obj =>  obj.marker && google.maps.geometry.poly.containsLocation(obj.marker.position, report_shape));
				for (let building of buildings){

					for (let floor of building.floors){
						for (let apartament of floor.apartments){
							if(apartament.client){
								$rootScope.item_reportQtd['clients'].qtd++;
							}
						}
						for (let ap of floor.access_points){
							
							if(ap.category === 1){
								$rootScope.item_reportQtd['access_points'].qtdFontes++;
							}else if(ap.category === 2){
								$rootScope.item_reportQtd['access_points'].qtdArmarios++;
							}else if(ap.category === 3){
								$rootScope.item_reportQtd['access_points'].qtdPacs++;
							}else if(ap.category === 4){
								$rootScope.item_reportQtd['access_points'].qtdCxEmenda++;
							}else if(ap.category === 5){
								$rootScope.item_reportQtd['access_points'].qtdCxAtendimento++;
							}

							$rootScope.item_reportQtd['access_points'].qtdTotal++;
						}

						for (let cables of building.cables){
							$rootScope.item_reportQtd['cables'].qtd++;
						}
					}
					
				}

			},10);

		},

		saveItemReport : function(){
			var first_table_drawn = false;
			
		    var doc = new jsPDF('p', 'pt');
		    
		    var pageY = 60;

		    doc.setFontSize(18);
		    doc.text($rootScope.Users.translateText("MAPWISP - Relatório de Itens"), 40, pageY);
		    	    
			pageY = pageY + 30;
			
			columns = [$rootScope.Users.translateText("Tipo"), $rootScope.Users.translateText("Nome")];
            
            var cont = 0;
            var first_table_drawn = false;

		    $rootScope.item_report.access_points.forEach(a =>{

		    	if(a.length){

					//Define starting point in PDF page
					if (!first_table_drawn){
						pageY = 90;
						first_table_drawn = true;
					} else {
						pageY = doc.autoTableEndPosY() + 30;
					}

                    rows = [];
					a.forEach(ap =>{
						row = [];
						row.push(ap.type_name);
						row.push(ap.name);
						rows.push(row);
					});

					switch(cont){
						case 1:
							doc.text($rootScope.Users.translateText('Fonte') + ' : ' + $rootScope.item_reportQtd.access_points.qtdFontes, 20, pageY);
							break;
						case 2:
							doc.text($rootScope.Users.translateText('Armário') + ' : ' + $rootScope.item_reportQtd.access_points.qtdArmarios, 20, pageY);
							break;
						case 3:
							doc.text($rootScope.Users.translateText('PAC') + ' : ' + $rootScope.item_reportQtd.access_points.qtdPacs, 20, pageY);
							break;
						case 4:
							doc.text($rootScope.Users.translateText('Caixa de emendas') + ' : ' + $rootScope.item_reportQtd.access_points.qtdCxEmenda, 20, pageY);
							break;
						case 5:
							doc.text($rootScope.Users.translateText('Caixa de atendimento') + ' : ' + $rootScope.item_reportQtd.access_points.qtdCxAtendimento, 20, pageY);
							break;
						default:
							break;
					}

// 					rows.push([$rootScope.Users.translateText("Total"), a.length]);

					doc.autoTable(columns, rows, {
						startY: pageY + 10,
// 						pageBreak: 'avoid',
						overflow: "linebreak"
					});

		    	}

				cont++;
			});

			var writeTitle = true;
			
			$rootScope.item_report.cables.forEach(a =>{

		    	if(a.length){

		    		//Define starting point in PDF page
					if (!first_table_drawn){
						pageY = 90;
						first_table_drawn = true;
					} else {
						pageY = doc.autoTableEndPosY() + 30;
					}

                    //evita titulo aparecer mais de uma vez
                    if(writeTitle){

					    doc.text($rootScope.Users.translateText('Cabos') + ' : ' + $rootScope.item_reportQtd.cables.qtd, 30, pageY);
					    writeTitle = false;

                    }
                    
                    rows = [];
					a.forEach(cb =>{
						row = [];
						row.push(cb.type_name);
						row.push(cb.name);
						rows.push(row);
					});

// 					rows.push([$rootScope.Users.translateText("Total"), a.length]);

					doc.autoTable(columns, rows, {
						startY: pageY + 10,
						overflow: "linebreak",
					});
		    	}
			});

			if($rootScope.item_reportQtd.clients.qtd){

				//Define starting point in PDF page
				if (!first_table_drawn){
					pageY = 90;
					first_table_drawn = true;
				} else {
					pageY = doc.autoTableEndPosY() + 30;
				}

				doc.text($rootScope.Users.translateText('Clientes') + ' : ' + $rootScope.item_reportQtd.clients.qtd, 30, pageY);

				columns = [$rootScope.Users.translateText("Nome")];
				rows = [];

				$rootScope.item_report.clients.forEach(cli =>{

					row = [];
					row.push(cli.name);
					rows.push(row);

				});

				doc.autoTable(columns, rows, {
					startY: pageY + 10,
					overflow: "linebreak",
				});
			}

			if($rootScope.item_reportQtd.posts.qtd){

				//Define starting point in PDF page
				if (!first_table_drawn){
					pageY = 90;
					first_table_drawn = true;
				} else {
					pageY = doc.autoTableEndPosY() + 30;
				}

				doc.text($rootScope.Users.translateText('Postes') + ' : ' + $rootScope.item_reportQtd.posts.qtd
                + ' - ' + $rootScope.Users.translateText('Ferragens em postes') + ' : ' + $rootScope.item_reportQtd.posts.qtd_Material, 30, pageY);

				columns = [$rootScope.Users.translateText("Nome"),$rootScope.Users.translateText("Quantidade")];
				rows = [];

				$rootScope.item_report.posts.material.forEach(mat =>{

					row = [];
					row.push(mat.name);
					row.push(mat.quantity);
					rows.push(row);

				});

				if($rootScope.item_reportQtd.posts.qtd_Material){

					pageY += 30;

// 					doc.text($rootScope.Users.translateText('Ferragens em postes') + ' : ' + $rootScope.item_reportQtd.posts.qtd_Material, 30, pageY);

// 					rows.push([$rootScope.Users.translateText("Total"), $rootScope.item_reportQtd.posts.qtd_Material]);

					doc.autoTable(columns, rows, {
						startY: pageY + 10,
						overflow: "linebreak",
					});
				}
			}
			
		    doc.save('MAPWISP-RelatorioDeItens.pdf');
		},

		getItemReportQtd : function(){
			$timeout(function(){
				//Initial variables
				//backup do valor de dotsCount
				$rootScope.dotsCount = $rootScope.dotsCounter;
				$rootScope.item_reportQtd = [];
				
				if ($rootScope.fixed_region_report_flag){
					var report_shape = $rootScope.fixedRegionReportShape;
				} else {
					var report_shape = $rootScope.shapeTemp;
				}
				
				//CABLES
				$rootScope.item_reportQtd['cables'] = [];
				$rootScope.item_reportQtd['cables'].qtd = 0;

                var cable1 = $rootScope.Cables.cables[1].filter(obj =>  self.anyPointInsideQuick(obj, report_shape, 10));
				$rootScope.item_reportQtd['cables'].qtd += cable1.length;

				var cable2 = $rootScope.Cables.cables[2].filter(obj =>  self.anyPointInsideQuick(obj, report_shape, 10));
				$rootScope.item_reportQtd['cables'].qtd += cable2.length;

				var cable3 = $rootScope.Cables.cables[3].filter(obj =>  self.anyPointInsideQuick(obj, report_shape, 10));
				$rootScope.item_reportQtd['cables'].qtd += cable3.length;

				var cable4 = $rootScope.Cables.cables[4].filter(obj =>  self.anyPointInsideQuick(obj, report_shape, 10));
				$rootScope.item_reportQtd['cables'].qtd += cable4.length;

				$rootScope.$apply();

				//ACCESS POINTS
				$rootScope.item_reportQtd['access_points'] = [];
				$rootScope.item_reportQtd['access_points'].qtdTotal = 0;
				$rootScope.item_reportQtd['access_points'].qtdFontes = 0;
				$rootScope.item_reportQtd['access_points'].qtdArmarios = 0;
				$rootScope.item_reportQtd['access_points'].qtdPacs = 0;
				$rootScope.item_reportQtd['access_points'].qtdCxEmenda = 0;
				$rootScope.item_reportQtd['access_points'].qtdCxAtendimento = 0;

				var fontes = $rootScope.AccessPoints.accessPoints[1].filter(obj =>  obj.dot && google.maps.geometry.poly.containsLocation(obj.dot.position, report_shape));
				$rootScope.item_reportQtd['access_points'].qtdFontes = fontes.length;
				
				var armarios = $rootScope.AccessPoints.accessPoints[2].filter(obj =>  obj.dot && google.maps.geometry.poly.containsLocation(obj.dot.position, report_shape));
				$rootScope.item_reportQtd['access_points'].qtdArmarios = armarios.length;
				
				var pacs = $rootScope.AccessPoints.accessPoints[3].filter(obj =>  obj.dot && google.maps.geometry.poly.containsLocation(obj.dot.position, report_shape));
				$rootScope.item_reportQtd['access_points'].qtdPacs = pacs.length;
				
				var cxEm = $rootScope.AccessPoints.accessPoints[4].filter(obj =>  obj.dot && google.maps.geometry.poly.containsLocation(obj.dot.position, report_shape));
				$rootScope.item_reportQtd['access_points'].qtdCxEmenda = cxEm.length;
				
				var cxAt = $rootScope.AccessPoints.accessPoints[5].filter(obj =>  obj.dot && google.maps.geometry.poly.containsLocation(obj.dot.position, report_shape));
                $rootScope.item_reportQtd['access_points'].qtdCxAtendimento = cxAt.length;

                $rootScope.item_reportQtd['access_points'].qtdTotal = fontes.length + armarios.length + pacs.length + cxEm.length + cxAt.length;

				$rootScope.$apply();

				// POSTS
				$rootScope.item_reportQtd['posts'] = [];
				$rootScope.item_reportQtd['posts'].qtd = 0;
				$rootScope.item_reportQtd['posts'].qtd_Material = 0;

				var posts = $rootScope.Posts.posts.filter(obj =>  obj.dot && google.maps.geometry.poly.containsLocation(obj.dot.position, report_shape));
                $rootScope.item_reportQtd['posts'].qtd = posts.length;

                for (var post of posts){
                	for(var material of post.material_types){
                	    $rootScope.item_reportQtd['posts'].qtd_Material += material._joinData.quantity;;              	
                	}
                }

                $rootScope.$apply();

				//CLIENTS
				$rootScope.item_reportQtd['clients'] = [];
				$rootScope.item_reportQtd['clients'].qtd = 0;
				
				var clients = $rootScope.Clients.clients.filter(obj =>  obj.marker && google.maps.geometry.poly.containsLocation(obj.marker.position, report_shape));
                $rootScope.item_reportQtd['clients'].qtd = clients.length;
                $rootScope.$apply();

				//conta itens nos prédios
				var buildings = $rootScope.Buildings.buildings.filter(obj =>  obj.marker && google.maps.geometry.poly.containsLocation(obj.marker.position, report_shape));
				for (let building of buildings){

					for (let floor of building.floors){
						for (let apartament of floor.apartments){
							if(apartament.client){
								$rootScope.item_reportQtd['clients'].qtd++;
							}
						}
						for (let ap of floor.access_points){
							
							if(ap.category === 1){
								$rootScope.item_reportQtd['access_points'].qtdFontes++;
							}else if(ap.category === 2){
								$rootScope.item_reportQtd['access_points'].qtdArmarios++;
							}else if(ap.category === 3){
								$rootScope.item_reportQtd['access_points'].qtdPacs++;
							}else if(ap.category === 4){
								$rootScope.item_reportQtd['access_points'].qtdCxEmenda++;
							}else if(ap.category === 5){
								$rootScope.item_reportQtd['access_points'].qtdCxAtendimento++;
							}

							$rootScope.item_reportQtd['access_points'].qtdTotal++;
						}
					}

					for (let cables of building.cables){
                        $rootScope.item_reportQtd['cables'].qtd++;
					}
					
				}
		
			},10);

		},
		
		//------------------------------------------------------------//
		// RELATORIO DE Clientes
		//------------------------------------------------------------//
		
		regionClientReport : function(){
			//Send event to analytics
			if ($rootScope.run_analytics) {
				ga("send", {
					hitType: "event",
					eventCategory: "RegionReports",
					eventAction: "Get Region Client Report",
					eventLabel: "Client Report"
				});
			}

			//OPEN MODAL
			var options = {
					autoOpen: false,
					modal: false,
					title: $rootScope.Users.translateText('Relatório de Clientes'),
					width: 600,
					height:'auto',
					maxHeight: 800,
					resizable:false,
					dialogClass: "noclose",
					close:function(){
						$rootScope.client_report = [];
					}
			};
			model = [];
			$rootScope.dotsCounter = $rootScope.dotsCount;
			dialogService.open('regionClientReportModal','regionClientReportModal', model, options).then();

			//---------
			self.client_report_loading = true;
			$timeout(function(){
				self.getRegionClientReport();
			},100);
		},
		
		cancelRegionClientReport : function(){
			dialogService.close('regionClientReportModal');
			angular.forEach($rootScope.dotsTemp,function(val,index){
				val.setMap(null);
			});
			$rootScope.shapeTemp.setMap(null);
			$rootScope.shapeTemp = [];
			$rootScope.dotsTemp = [];
			$rootScope.tempPath = [];
			$rootScope.dotsCount = 0;
		},

		getRegionClientReport : function(){
			$timeout(function(){
				//Initial variables
				//backup do valor de dotsCount
				$rootScope.dotsCount = $rootScope.dotsCounter;
				$rootScope.client_report = [];

				if ($rootScope.fixed_region_report_flag){
					var report_shape = $rootScope.fixedRegionReportShape;
				} else {
					var report_shape = $rootScope.shapeTemp;
				}

				access_point_connections = $rootScope.Connections.list_all_connections();


				// CLIENTS
				$rootScope.client_report['access_points'] = [];
				$rootScope.client_report['splitters'] = [];
				$rootScope.client_report['clients'] = [];
				$rootScope.client_report['clients'][1] = [];
				$rootScope.client_report['splitters'].quantity = 0;	
				$rootScope.client_report['splitters'].total_ports = 0;	
				$rootScope.client_report['splitters'].available_ports = 0;
				$rootScope.client_report['splitters'].reserved_clients = 0;
				$rootScope.client_report['splitters'].ports_reserved = 0;
				$rootScope.client_report['splitters'].connected_clients = 0;
				$rootScope.client_report['clients'][1].prospects = 0;
				$rootScope.client_report['clients'][1].actives = 0;
				$rootScope.client_report['clients'][1].reserveds = 0;
				$rootScope.client_report['clients'][1].total = 0;
				var total_ports = 0;
				var reserved_clients = 0;
				var connected_clients = 0;
				var available_ports = 0;
				
				$rootScope.client_report['access_points_atendimento'] = 0;
				
				// Pega array de caixas de atendimento na area selecionada
				var aps = $rootScope.AccessPoints.accessPoints[5].filter(obj =>  obj.dot && google.maps.geometry.poly.containsLocation(obj.dot.position, report_shape));
                for (let ap of aps){

				    //veirifica e soma clientes ativos ou reservados
					self.getClientsInAp(ap.id);
				}

				var clients = $rootScope.Clients.clients.filter(obj =>  obj.marker && google.maps.geometry.poly.containsLocation(obj.marker.position, report_shape));
                for (let client of clients){

					$rootScope.client_report['clients'][1].total += 1;
					if (!client.ap_id_connected){
						$rootScope.client_report['clients'][1].prospects += 1;
					}
				}

				var buildings = $rootScope.Buildings.buildings.filter(obj =>  obj.marker && google.maps.geometry.poly.containsLocation(obj.marker.position, report_shape));
				for (let building of buildings){

					for (let floor of building.floors){
						for (let apartament of floor.apartments){
							if(apartament.client){
								if(!apartament.client.ap_id_connected){
								    $rootScope.client_report['clients'][1].prospects++;
								}
							}
						}
						for (let ap of floor.access_points){
							self.getClientsInAp(ap.id);

						}
					}
					
				}

				self.client_report_loading = false;
				$rootScope.$apply();

			},10);
		},

		/*
           Verifica e soma se cliente estiver ativo ou reservado
		*/
		getClientsInAp : function(ap_id){
			$rootScope.client_report['access_points_atendimento'] += 1;
			conns = $rootScope.Connections.getApConnections(ap_id).then(function(conns){						  
				angular.forEach(conns, function(conn, conn_idx){
					if (conn.splitter){
						
						$rootScope.client_report['splitters'].total_ports += conn.splitter.ports_number;
						var avail = conn.splitter.ports_number - (conn.fusions_in.length + conn.fusions_out.length);
						
						$rootScope.client_report['splitters'].available_ports += avail;
					} else if (conn.client){
						if ((conn.fusions_in.length > 0) || (conn.fusions_out.length > 0)){
							$rootScope.client_report['splitters'].connected_clients++;
							
						    $rootScope.client_report['clients'][1].actives++;
						} else {
							$rootScope.client_report['splitters'].reserved_clients++;
							$rootScope.client_report['clients'][1].reserveds = $rootScope.client_report['splitters'].reserved_clients;
						}
					}


				});
				
				if (!$rootScope.client_report['splitters'].quantity){
					$rootScope.client_report['splitters'].quantity = 0;
					$rootScope.client_report['splitters'].ports_reserved = 0;
				}
				$rootScope.client_report['splitters'].quantity += $rootScope.client_report['splitters'].total_ports;
				$rootScope.client_report['splitters'].ports_reserved += $rootScope.client_report['splitters'].reserved_clients;
			});
		},		

		//------------------------------------------------------------//
		// RELATORIO DE Clientes Detalhes
		//------------------------------------------------------------//
		
		regionClientReportDetail : function(){
			//Send event to analytics
			if ($rootScope.run_analytics) {
				ga("send", {
					hitType: "event",
					eventCategory: "RegionReports",
					eventAction: "Get Region Client Report Detail",
					eventLabel: "Client Report Detail"
				});
			}

			//OPEN MODAL
			var options = {
					autoOpen: false,
					modal: false,
					title: $rootScope.Users.translateText('Relatório de Clientes Detalhes'),
					width: 700,
					height:550,
					maxHeight: 550,
					resizable:false,
					dialogClass: "noclose",
					close:function(){
						$rootScope.client_report = [];
					}
			};
			model = [];
			$rootScope.dotsCounter = $rootScope.dotsCount;
			dialogService.open('regionClientReportDetailModal','regionClientReportDetailModal', model, options).then();

			//---------
			self.client_report_loading = true;
			$timeout(function(){
				self.getRegionClientReportDetail();
			},100);
		},
		
		cancelRegionClientReportDetail : function(){
			dialogService.close('regionClientReportDetailModal');
			angular.forEach($rootScope.dotsTemp,function(val,index){
				val.setMap(null);
			});
			$rootScope.shapeTemp.setMap(null);
			$rootScope.shapeTemp = [];
			$rootScope.dotsTemp = [];
			$rootScope.tempPath = [];
			$rootScope.dotsCount = 0;
		},

		getRegionClientReportDetail : function(){
			$timeout(function(){
				//Initial variables
				//backup do valor de dotsCount
				$rootScope.dotsCount = $rootScope.dotsCounter;
				$rootScope.client_report = [];

				if ($rootScope.fixed_region_report_flag){
					var report_shape = $rootScope.fixedRegionReportShape;
				} else {
					var report_shape = $rootScope.shapeTemp;
				}

				$rootScope.client_report['clients'] = [];

				var count = 0;

				var clients = $rootScope.Clients.clients.filter(obj =>  obj.marker && google.maps.geometry.poly.containsLocation(obj.marker.position, report_shape));

                var buildings = $rootScope.Buildings.buildings.filter(obj =>  obj.marker && google.maps.geometry.poly.containsLocation(obj.marker.position, report_shape));
				for (let building of buildings){

					for (let floor of building.floors){
						for (let apartament of floor.apartments){
							if(apartament.client){
							    clients.push(apartament.client);
							}
						}
					}
					
				}

				for (let client of clients){

					$rootScope.client_report['clients'][count] = [];
					$rootScope.client_report['clients'][count].name = client.name;

					link = $rootScope.base_url+"/clients/findConnClient";
					data = {};
					data.id = client.id;
					$.ajax({
						url: link,
						type: "POST",
						data: data,
						async: false,
						success:function(response){
							$rootScope.client_report['clients'][count].apName = response.apName;
							$rootScope.client_report['clients'][count].splitterName = response.splitterName;
							$rootScope.client_report['clients'][count].splitterPort = response.splitterPort;
						},
				   });
				    count++;
						
				}

				self.client_report_loading = false;
				$rootScope.$apply();

			},10);
		},

		saveClientDetailReport : function(){
			var first_table_drawn = false;

		    var doc = new jsPDF('p', 'pt');
		    doc.setFontSize(18);
		    doc.text($rootScope.Users.translateText("MAPWISP - Relatório de Clientes Detalhes"), 40, 30);
		    doc.setFontSize(12);
		    
		    if ($rootScope.client_report.clients.length > 0){
		    	//Define starting point in PDF page
		    	if (!first_table_drawn){
		    		pageY = 90;
		    		first_table_drawn = true;
		    	} else {
		    		pageY = doc.autoTableEndPosY() + 30;
		    	}
		    	//Define table content:
		    	columns = [$rootScope.Users.translateText("Nome"), $rootScope.Users.translateText("Caixa"), $rootScope.Users.translateText("Splitter"), $rootScope.Users.translateText("Porta")];
		    	rows = [];
		    	
				for (var i = 0; i < $rootScope.client_report.clients.length; i++){
					var client = $rootScope.client_report.clients[i];
		    		if (client){
			    		row = [];
			    		row.push(client.name);
			    		row.push(client.apName);
			    		row.push(client.splitterName);
			    		row.push(client.splitterPort);
			    		rows.push(row);
		    		}
		    	};
		    	//Draw Table
			    doc.autoTable(columns, rows, {
			        startY: false,
			        pageBreak: 'avoid',
			    });
			}

		    doc.save('MAPWISP-RelatorioClienteDetalhes.pdf');
		},

        /**
		 * Print map 
		 * Shows a view of map in large size 
         * Allow to print map and access points on the selected area
		 * */
		printMap : function(){

			self.map_area_loading = true;

			var options = {
				autoOpen: false,
				modal: true,
				title: $rootScope.Users.translateText('Imprimir mapa'),
				width: 1100,
				height:700,
				resizable:true,
				dialogClass: "noclose", 
				position: {
					my: "center",
					at: "center",
					of: window,
					collision: "none"
				},
				create: function (event, ui) {
					$(event.target).parent().css('position', 'fixed');
					
				},   
				close:function(){
					$rootScope.form = [];

				}    
			};
			model = [];
			$rootScope.form = [];
			$rootScope.form.error = [];
			$rootScope.message_error_modal = '';

			dialogService.open('printMap','printMap', model, options).then(function(){

				var centerLat = Map.map.getCenter().lat();
				var centerLng = Map.map.getCenter().lng();

				//Criar mapa e centralizar
                
                latLng = new google.maps.LatLng(centerLat, centerLng);

				var mapOptions = {
					zoom: 16,
					tilt: Map.map.getTilt() === 0 ? 0.00001 : Map.map.getTilt(), //evita mapa ficar serrilhado
					heading: Map.map.getHeading(),
					center: latLng,
					mapTypeId: google.maps.MapTypeId.ROADMAP,
					disableDefaultUI: true,
					minZoom: 0,
					draggableCursor: 'crosshair',
					gestureHandling: 'greedy',
					mapId: "1af6720832a6f3af",
				};

                //Necessário para o mapa aparecer na impressão
				HTMLCanvasElement.prototype.getContext = function(origFn) {
				  return function(type, attribs) {
					attribs = attribs || {};
					attribs.preserveDrawingBuffer = true;
					return origFn.call(this, type, attribs);
				  };
				}(HTMLCanvasElement.prototype.getContext);

				//setando o mapa
				Map.mapArea = new google.maps.Map(document.getElementById("map-area"), mapOptions);

                $rootScope.dotsCount = $rootScope.dotsTemp.length;

				loadItems();

				function loadItems(){

					var report_shape = $rootScope.shapeTemp;

					//pega itens dentro da area selecionada

					//pega aps 
					var fontes = $rootScope.AccessPoints.accessPoints[1].filter(obj =>  obj.dot && google.maps.geometry.poly.containsLocation(obj.dot.position, report_shape));
					var armarios = $rootScope.AccessPoints.accessPoints[2].filter(obj =>  obj.dot && google.maps.geometry.poly.containsLocation(obj.dot.position, report_shape));
					var pacs = $rootScope.AccessPoints.accessPoints[3].filter(obj =>  obj.dot && google.maps.geometry.poly.containsLocation(obj.dot.position, report_shape));
					var cxEm = $rootScope.AccessPoints.accessPoints[4].filter(obj =>  obj.dot && google.maps.geometry.poly.containsLocation(obj.dot.position, report_shape));
					var cxAt = $rootScope.AccessPoints.accessPoints[5].filter(obj =>  obj.dot && google.maps.geometry.poly.containsLocation(obj.dot.position, report_shape));

					self.aps = [...fontes,...armarios,...pacs,...cxEm,...cxAt];

					self.aps.filter(a => a).forEach(ap =>{

						// Draw Marker
						ap.tempMarker = new google.maps.Marker({
							icon : ap.dot.icon,
							position: new google.maps.LatLng(ap.dot.position.lat(), ap.dot.position.lng()),
							draggable:false,
						   });
						
						ap.tempMarker.setMap(Map.mapArea);

					});

					// var clients = $rootScope.Clients.clients.filter(obj =>  obj.dot && google.maps.geometry.poly.containsLocation(obj.marker.position, report_shape));

					// clients.filter(a => a).forEach(cl =>{

					//     cl.tempMarker = new google.maps.Marker({
					// 		icon : cl.marker.icon,
					// 		position: new google.maps.LatLng(cl.dot.lat, cl.dot.lng),
					// 		draggable:false,
					// 	   });
					// 	cl.tempMarker.setMap(Map.mapArea);

					// });

					var cable1 = $rootScope.Cables.cables[1].filter(obj =>  $rootScope.RegionReports.anyPointInsideQuick(obj, $rootScope.shapeTemp, 10));
					var cable2 = $rootScope.Cables.cables[2].filter(obj =>  $rootScope.RegionReports.anyPointInsideQuick(obj, $rootScope.shapeTemp, 10));
					// var cable3 = $rootScope.Cables.cables[3].filter(obj =>  $rootScope.RegionReports.anyPointInsideQuick(obj, $rootScope.shapeTemp, 10));
					// var cable4 = $rootScope.Cables.cables[4].filter(obj =>  $rootScope.RegionReports.anyPointInsideQuick(obj, $rootScope.shapeTemp, 10));

					var cables = [...cable1,...cable2];

					cables.filter(a => a).forEach(cb =>{

						cb.tempPath = [];
						for(var dot of cb.dots) {
							cb.tempPath.push(new google.maps.LatLng(dot.position.lat(), dot.position.lng()));
						}

						cb.polyline = Map.drawPolyline(cb.tempPath, cb.name, cb.polyline.strokeColor, cb.deploy_information.deployed);
						cb.polyline.setMap(Map.mapArea);

					});

					var buildings = $rootScope.Buildings.buildings.filter(obj =>  obj.dot && google.maps.geometry.poly.containsLocation(obj.marker.position, report_shape));

					buildings.filter(a => a).forEach(bu =>{

						bu.tempMarker = new google.maps.Marker({
							icon : bu.marker.icon,
							position: new google.maps.LatLng(bu.dot.lat, bu.dot.lng),
							draggable:false,
						   });
						bu.tempMarker.setMap(Map.mapArea);

					});

					var posts = $rootScope.Posts.posts.filter(obj =>  obj.dot && google.maps.geometry.poly.containsLocation(obj.dot.position, report_shape));

					posts.filter(a => a).forEach(po =>{

						po.tempMarker = new google.maps.Marker({
							icon : po.dot.icon,
							position: new google.maps.LatLng(po.dot.position.lat(), po.dot.position.lng()),
							draggable:false,
						   });
						po.tempMarker.setMap(Map.mapArea);

					});
				}

                $timeout(function() {
				    self.map_area_loading = false;
				}, 6000);

			});

		},

        /**
		 * rotateMapArea 
		 * Make map rotation
		 * */
		rotateMapArea : function(amount){

            Map.mapArea.setHeading(Map.mapArea.getHeading() + amount);

        },

        /**
		 * viewInfowindows 
		 * Shows or hide labels of access points on the map view for print
		 * */
		viewInfowindows : function(show){

			self.map_area_loading = true;

			self.aps.filter(a => a).forEach(ap =>{

				var label = {text: ap.name,color: 'gray',fontWeight: '900'};

				show ? ap.tempMarker.setLabel(label) : ap.tempMarker.setLabel(null);

			});

			$timeout(function() {
				self.map_area_loading = false;
			}, 6000);

		},

        /**
		 * printAps 
		 * Print every pdf of access points in the selected area
		 * */
		printAps : function(){

			self.print_aps_loading = true;

			self.aps = [];

			var report_shape = $rootScope.shapeTemp;

			var fontes = $rootScope.AccessPoints.accessPoints[1].filter(obj =>  obj.dot && google.maps.geometry.poly.containsLocation(obj.dot.position, report_shape));
			var armarios = $rootScope.AccessPoints.accessPoints[2].filter(obj =>  obj.dot && google.maps.geometry.poly.containsLocation(obj.dot.position, report_shape));
			var pacs = $rootScope.AccessPoints.accessPoints[3].filter(obj =>  obj.dot && google.maps.geometry.poly.containsLocation(obj.dot.position, report_shape));
			var cxEm = $rootScope.AccessPoints.accessPoints[4].filter(obj =>  obj.dot && google.maps.geometry.poly.containsLocation(obj.dot.position, report_shape));
			var cxAt = $rootScope.AccessPoints.accessPoints[5].filter(obj =>  obj.dot && google.maps.geometry.poly.containsLocation(obj.dot.position, report_shape));

			self.aps = [...fontes,...armarios,...pacs,...cxEm,...cxAt];

			var i = 0;

			if(self.aps){
				printAp(i);
			}

            //Cria conexoes e fusoes de cada caixa e imprime
			function printAp(i) {

				$rootScope.Connections.createConnections(self.aps[i], false).then(
					function(data){
						$rootScope.Connections.connections = data;
						//Criar Hosts
						$rootScope.Connections.createHosts(self.aps[i]).then(function(hosts){						
							$rootScope.Connections.hosts = hosts;
							//seta connect = true para imprimir fusoes da olt
							angular.forEach(hosts, function(host, index_host){
							angular.forEach(host.ports, function(port, index_port){
								if (port.connection_id){
									port.connected = true;
								}
							});
							});
							//esse timeout serve para esperar as connections serem desenhadas,
							//para depois disso desenhar as fusions.
							$timeout(function() {
								$rootScope.Connections.accessPointOpened = self.aps[i];
								$rootScope.AccessPoints.printAccessPoint();

								$rootScope.Connections.connectionsOrHostsLeft = false;
								$rootScope.Connections.accessPointConnectionsTemp = null;
								$rootScope.Connections.connections = [];
								$rootScope.Connections.hosts = [];

								i++;

								if(self.aps[i]){

									printAp(i);

								}else{
									self.print_aps_loading = false;
								}

							}, 900);
						});
					});
			}


		},
		
        /**
		 * printImageMap 
		 * Print map of selected area
		 * */
		printImageMap : function(){

			self.map_area_loading = true;

            // cria doc pdf com true para comprimir
            var doc = new jsPDF('l','px','a1',true);

            //ajusta posição do mapa
            if(!self.fixedMapCanvas){
				$("#map-area>div>div").find("canvas:last").css({
					left:"95px",
					top:"-63px",
					position:"absolute",
					transform: "scale(1.063)"
				});
            }

            html2canvas(document.querySelector("#map-area"),{
            	useCORS: true,}).then(function(canvas) {

                imgData = canvas.toDataURL('image/jpg');

                //reseta posição do mapa 
                $("#map-area>div>div").find("canvas:last").css({
					left:"auto",
					top:"auto",
                    position:"static",
                    transform: "none"
				});

                //adiciona imagem criada do mapa ao pdf 
                // FAST pra comprimir
                doc.addImage(imgData,'JPEG', 0, 0, 1790, 1260,'','FAST');

                doc.save('Mapwisp_mapa.pdf');

				self.map_area_loading = false;

			});
			
		},

		/**
		 * Any Point Inside Quick Method
		 * Checks if any point in a cable is inside of a polygon/shape.
		 * 
		 * If it finds any point inside the shape, it returns true imediatly
		 * */
		anyPointInsideQuick : function(cable, shape, interval){
			//$timeout(function(){
				distance = parseFloat(Map.calculateLengthObject(cable.polyline.getPath().getArray()));
				for (i = 0; (i * interval)  < distance; i++) {
					point = cable.polyline.GetPointAtDistance(i * interval);
					point = new google.maps.LatLng(point.lat(), point.lng());
					if (google.maps.geometry.poly.containsLocation(point, shape)){
						return true;
					}
				}
				return false;
			//},1);
		},
	}
	
	return self;
});