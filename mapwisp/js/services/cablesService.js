app.service('Cables', function($http,Projects,Map,$rootScope,$timeout,dialogService,$q){
	
	/**
	 * Cables Service - Listagem e operacoes gerais em cabos
	 * 
	 * Cabos sao divididos em categorias:
	 * 		1 -  Fibra
	 *  	2 -  UTP
	 *  	3 -  Cordoalha
	 * 		4 -  DROP Padrao do sistema
	 * 
	 * */


	var self = {
		isLoading : false,
		cableTypes : [],	
		cableSelected : false,
		cableTypesAdd : [],
		cableCordoalhaTypes : [],
		cables : [],
		editing: false,
		cables_loaded_width : "0%",
		viewAllCordoalhas: false,
		bulkEdit : false,
		bulkUndeploy : false,
        bulkDeploy : false,
        bulkCategory : 0,
		arrCableTypes : [],
		tipCableUsed : false,
        cableErrors : [],

		/**
		 * Update Items Menu
		 * This will create an array called cablesItemMenu, where only the cables of the currently selected projects will be added.
		 * The functionality is to make only items from current projects appear in the itemsMenu modal.
		 * */
		updateItemsMenu : function(){
			self.cablesItemMenu = [];
			angular.forEach(self.cables, function(cables, indexType){
				self.cablesItemMenu[indexType] = [];
				angular.forEach(cables, function(cable,indexCable){
					if ((itemInArray(cable.project, $rootScope.Projects.projectsChecked)) && (cable.category != 4)){
						self.cablesItemMenu[indexType].push(cable);
					}
				})
			})
		},

		addDot : function(){

			if (self.isRequestInProgress) {
				// Impede novos requests enquanto outro está em andamento
				return;
			}
		
			self.isRequestInProgress = true; // Marca que a requisição está em andamento

			self.usingPositionOnCable = true;
			
			dataSend = {};
			dataSend.cable = self.cableSelected.id;
			dataSend.id = self.cableSelected.id;
			dataSend.add = 1;
			dataSend.dot = {};
			dataSend.dot.lat = self.positionOnCable.event.latLng.lat();
			dataSend.dot.lng = self.positionOnCable.event.latLng.lng(); 
			dataSend.prev_dot = self.positionOnCable.prevDot.id;

			$.ajax({
      			url:  $rootScope.base_url+'/cables/edit',
      			type: 'POST',
      			data: dataSend,
      			success:function(data){
					if(data.status === 1){
		                //redesenhar o cabo com o novo ponto
		                self.redrawCable(self.cableSelected.id, true);
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
	                if($rootScope.menuCable){
            			dialogService.close('menuCable');  
            			$rootScope.menuCable = false;
            		}
					self.isRequestInProgress = false; // Libera para novas requisições
				},
				complete:function(){
					self.positionOnCable = false;
					self.usingPositionOnCable = false;
					self.isRequestInProgress = false;
				}
			});

			self.usingPositionOnCable = false;
			
		},

		deleteCableDot : function(){

			var options = {
				autoOpen: false,
				modal: true,
				title: $rootScope.Users.translateText('Atenção'),
				width: 300,
				height:'auto',
				resizable:true,
				dialogClass: "noclose", 
			};
			model = [];  
			$rootScope.message_error_modal = "";
			dialogService.close('menuDotCable');
			dialogService.open('dotCableDelete','dotCableDelete', model, options).then();
			
		},

		deleteCableDotConfirm : function(){

            var prossegue = true, res = "";

			if(res = $rootScope.Reserves.reserves.find(r => r.dot_id === $rootScope.dotSelected.id)){
				prossegue = false;
			}

			if(res = $rootScope.Buildings.buildings.find(r => r.dot_id === $rootScope.dotSelected.id)){
				prossegue = false;
			}

			for (let apArray of $rootScope.AccessPoints.accessPoints){
               
                if(apArray){
                    if(res = apArray.find(ap => ap.dot.id === $rootScope.dotSelected.id)){
                        prossegue = false;
                    }                
                }             
            }

            for (let apArray of $rootScope.Cables.cables){
               
                if(apArray){
                    if(res = apArray.find(cb => cb.id === $rootScope.dotSelected.cableId)){
                        if(res.dots.length < 3){
                            prossegue = false;
                        }
                    }                
                }             
            }

            if(prossegue){

				var dataSend = {};

				dataSend.dot_id = $rootScope.dotSelected.id;
				dataSend.cable_id = $rootScope.dotSelected.cableId;
				dataSend.positioning = self.positionOnCable.positioning;

				link = $rootScope.base_url+'/cables/deleteDot'

				$.ajax({
					url: link,
					type: 'POST',
					data: dataSend,
					success:function(data){
						if(data.status === 1){
							self.redrawCable($rootScope.dotSelected.cableId, true);
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
						dialogService.close('dotCableDelete'); 
					},
				});

            }else{
				$rootScope.message_error_modal = $rootScope.Users.translateText('Este ponto não pode ser deletado');
				$timeout(function(){
					$rootScope.message_error_modal = "";
				},2000);
			}
            
		},

		cutCable : function(){

				var options = {
					autoOpen: false,
					modal: true,
					title: $rootScope.Users.translateText('Atenção'),
					width: 300,
					height:'auto',
					resizable:true,
					dialogClass: "noclose", 
			};
			model = [];  
			$rootScope.message_error_modal = "";
			/*$rootScope.cable_id = id;                    
			$rootScope.cableCategory= category;*/
			dialogService.open('cableCut','cableCut', model, options).then();

			
			
		},

		cutCableConfirm: function () {
			self.isLoading = true;

			var lat = self.positionOnCable.event.latLng.lat();
			var lng = self.positionOnCable.event.latLng.lng();
		
			const dataSend = {
				old_cable_id: self.cableSelected.id,
				dot: {// Novo ponto de corte
					lat: lat,
					lng: lng
				},
				prev_dot: self.positionOnCable.prevDot.id, // Ponto anterior ao corte
			};
		
			$.ajax({
				url: $rootScope.base_url + '/cables/cut',
				type: 'POST',
				data: dataSend,
				success:function(data){

					//adicionar o cabo cadastrado ao vetor
					if(data.status === 1){
						created_entity = data.data.newCable;
						oldCable = data.data.oldCable;
						cable = [];
						cable.id = created_entity.id;
						cable.name = created_entity.name;
						cable.category = created_entity.category;
						cable.cable_type_id = created_entity.cable_type_id;
						cable.deploy_information = created_entity.deploy_information;
						cable.cost = created_entity.cost;

						path = [];
						cable.dots = prepareDots(created_entity.dots);

						//descobrir a cor dependendo do tipo
						angular.forEach(self.cableTypes, function(type,index){
							angular.forEach(type, function(tp,index){
								if(tp.id == cable.cable_type_id){
									cor = tp.color;  
									cable.type_name = tp.name;
									cable.current_type_price = tp.price;
								}
							});
						});
						if (cable.category == 4){
							//Draw thinner line, if it's a DROP cable
							poly = Map.drawPolyline(path,cable.name,cor, false, true);
						} else {
							//poly = Map.drawPolyline(path,cable.name,cor, false);
							poly = self.cableSelected.polyline;
						}
						poly.setMap(Map.map);	

						cable.polyline = poly;

						//estava bagunçando o desenho do cabo, era preciso recarregar pra corrigir
						//Map.addListenerCable(cable);  

						switch(cable.category){
						case 1:
							self.cables[1].push(cable);
							break;
						case 2:
							self.cables[2].push(cable);
							break;
						case 3:
							self.cables[3].push(cable);
							break;
						case 4:
							self.cables[4].push(cable);
							$rootScope.Clients.setClientCable(cable.client.id, cable.id, 4, self.cables[4].length - 1);
							break;
						default:
							break;
						}
						if ((cable.category != 4) && (cable.category != 3)){
							self.addCableTreeView(created_entity.id, created_entity.name, self.cables[cable.category].length - 1, cable.category);
						}

						self.redrawCable(data.data.newCable.id, false);

	                    //remove desenho do cabo antigo e atualiza array
						angular.forEach(self.cables[self.cableSelected.category],function(el,index){
							if(el.id == self.cableSelected.id){
								el.polyline.setMap(null);
								self.cables[self.cableSelected.category][index].dots = prepareDots(oldCable.dots);
						}
						});
	
						self.redrawCable(data.data.oldCable.id, false);
						
						self.cableCut = true;	//usado pra recarregar fusões	

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
										
					if($rootScope.menuCable){
						$rootScope.dialogService.close('menuCable');  
					}
					
					$rootScope.$apply();

				},
				complete: function () {
					self.isLoading = false;
					$rootScope.dialogService.close('cableCut');
					$rootScope.$digest();
				}
			});

			//funcao recursiva que prepara os dots pro cabo ser desenhado
			function prepareDots(cableDots) {
				dots = [];
				angular.forEach(dots,function(pto,index){                
					path.push({lat:parseFloat(pto.lat),lng:parseFloat(pto.lng)});                              
					dot = Map.drawMarker(pto.lat, pto.lng,pto.id,'marker.png',$rootScope.Users.translateText('Guia do cabo'),'',0);
					dot.id = pto.id;
					dot.next_dot_id = pto._joinData.next_dot_id;
					dot.cableId = cable.id;
					dot.index = index;
					Map.addListenerDotCable(dot);
					dots.push(dot);
				});
				return dots;
			}			
			
		},		


		redrawCable : function(id,setEditable){

			angular.forEach(self.cables,function(cables,indexType){
				angular.forEach(cables,function(cableFromArray,indexThis){
					if(cableFromArray.id == id){
						//esconder a linha e limpar do mapa a variavel
						angular.forEach(cableFromArray.dots,function(dot,index){
							dot.setMap(null);
						});
						cableFromArray.polyline.setMap(null);
						cableFromArray = {};
						$.ajax({
			      			url:  $rootScope.base_url+'/cables/get',
			      			type: 'POST',
			      			data: {id:id},
			      			success:function(data){
				                //redesenhar o cabo com as informaçoes novas
			                
								if(data.id){

									cable = [];
									cable.id = data.id;
									cable.name = data.name;
									cable.category = data.category;
									cable.cable_type_id = data.cable_type_id;
									cable.deploy_information = data.deploy_information;
									cable.cost = data.cost;
									cable.owner = data.owner;
									path = [];
									dots = [];
									angular.forEach(data.dots,function(pto,index){                
										path.push({lat:parseFloat(pto.lat),lng:parseFloat(pto.lng)});                              
										dot = Map.drawMarker(pto.lat, pto.lng,pto.id,'marker.png',String(pto.id),'',0);
										dot.id = pto.id;
										dot.next_dot_id = pto._joinData.next_dot_id;
										dot.cableId = cable.id;
										dot.index = index;
										Map.addListenerDotCable(dot);
										dots.push(dot);
									});
									cable.dots = dots;


									//descobrir a cor dependendo do tipo
									angular.forEach(self.cableTypes, function(type,index){
										angular.forEach(type, function(tp,index){
											if(tp.id == cable.cable_type_id){
												cor = tp.color;  
												cable.type_name = tp.name;
												cable.current_type_price = tp.price;
											}
										});
									});
									if (cable.category == 4){
										//Draw thinner line, if it's a DROP cable
										poly = Map.drawPolyline(path,cable.name,cor, cable.deploy_information.deployed, true);
									} else {
										poly = Map.drawPolyline(path,cable.name,cor, cable.deploy_information.deployed);
									}
									poly.setMap(Map.map);	
									
									cable.polyline = poly;

									Map.addListenerCable(cable);
									
									self.cables[indexType][indexThis] = cable;

									if(setEditable){
										self.editPolyline(cable);	
									} else {
										self.editing = false;
									}								
									
									$rootScope.$apply();									
								}
							}
						});
					}
				});
			});
		},

        deploy : function(id){
			angular.forEach(self.cables, function(cable_type, index_type){
				angular.forEach(cable_type, function(current_cable,index_cable){
					if (current_cable.id == id){
						cable = current_cable;
					}
				})
			})
            if(cable.deploy_information.deployed){
                deploy = 0;
            }else{
                deploy = 1;
            }
            self.isLoading = true;
            $.ajax({
                url: $rootScope.base_url+'/cables/deploy',
                type: 'POST',
                data: {id:cable.id,deployed:deploy},
                success:function(data){            
                    if(data.status == 0){
                        var options = {
                            autoOpen: false,
                            modal: true,
                            title: $rootScope.Users.translateText('Atenção'),
                            width: 300,
                            height:'auto',
                            resizable:true,
                            dialogClass: "noclose", 
                        };
                        $rootScope.messageAlert = '<h6>'+data.message+'</h6>'
                        model = [];  
                    }else{
                        cable.deploy_information.deployed = deploy;
                        if(deploy){
                            self.redrawCable(cable.id,0);
                        }else{
                        	self.redrawCable(cable.id,0);
                        }
                    }            
                },
                complete:function(){
                    self.isLoading = false;
                    self.menuCable = false;  
                    dialogService.close('menuCable');  
                    $rootScope.$digest();
                }
            })
      },

		tipCableisUsed : function(dot_id){

			for (var i = 1; i <= 5; i++){
				if($rootScope.AccessPoints.accessPoints[i].find(a => a.dot.id === dot_id)){
					self.tipCableUsed = true;
					
					$rootScope.message_error = $rootScope.Users.translateText('Ponta do cabo ja esta sendo usada. Algumas opções ficaram desabilitadas.');
					$timeout(function() {
						$rootScope.message_error = '';
					}, 3000);
					
				}
				
			}
			
		},		
		
		findPositionOnCable : function(cable,event){
			var d = $q.defer();
			var posicaoNoCabo3,posicaoNoCabo,posicaoNoCabo2 = false;		
			var path1 = cable.polyline.getPath().getArray(),key, tamA, tamB, tamAB, tam = 0;	
			var objAnt = [];
			var objProx = [];
			self.tipCableUsed = false;
			//para cada ponto do cabo
			$.each(path1,function(key){
				if(path1[key+1]){
					//do ponto que eu estou ate  o ponto clicado
					tamA = Map.calculateDistance2Dots(event.latLng.lat(), event.latLng.lng(), path1[key].lat(), path1[key].lng());
					//do ponto que eu estou ate  o proximo ponto depois do ponto atual
					tamB = Map.calculateDistance2Dots(event.latLng.lat(), event.latLng.lng(), path1[key+1].lat(), path1[key+1].lng());
					tamAB = Map.calculateDistance2Dots( path1[key+1].lat(), path1[key+1].lng(),  path1[key].lat(), path1[key].lng());
					//apenas dimivui a precisao do calculo de 4 para 3 ao verificar e agora ele esta encontrando a ponto e o final do cabo				
					if((tamA+tamB).toFixed(3) == tamAB.toFixed(3)){
						tam = tam + tamA;
						posicaoNoCabo = (tam * 1000).toFixed(4);
						posicaoNoCabo3 = key+1;
						if(key == 0 && tamA.toFixed(3)<= 0.0050){
							posicaoNoCabo2 = 'begin';
						}else if((key+1) == (path1.length-1) && tamB.toFixed(4)<= 0.0060){
							posicaoNoCabo = (tam * 1000).toFixed(3);
							posicaoNoCabo2 = 'end';					
						}else posicaoNoCabo2 = 'middle';
					}else{
						tam = tam + tamAB;
					}				
				}
			});
			
			if(posicaoNoCabo && posicaoNoCabo2 ){
				
				//encontrar a posição que ficara o ponto novo
				//verificar os pontos do cabo e encontrar entr quais esta o ponto clicado
				ptosTemp = [];
				found = false;
				if(posicaoNoCabo2 =='middle'){
					$.each(cable.dots, function(index, val) {
				
						newDot = new google.maps.LatLng(val.getPosition().lat(),val.getPosition().lng());
						newDot.id = val.id;

						ptosTemp.push(newDot);

						if(index > 0){							
							ptosTemp[ptosTemp.length-1]['posicao'] = parseFloat(Map.calculateLengthObject(ptosTemp));
							ptosTemp = ptosTemp;
						}else{
							ptosTemp[ptosTemp.length-1]['posicao'] = 0;							
							ptosTemp = ptosTemp;
						}
					});

					//agora que eu tenho a posição de cada ponto no cabo eu tenho que ver qual é o proximo e qual é o anterior ao ponto que eu estou
					ptoAnterior = 0;
					indexPtoAnt = 0;

					proximoPto = false;

					//formatando
					posicaoNoCabo = parseFloat(posicaoNoCabo);
					posicaoNoCabo = Math.round(posicaoNoCabo);


					
					$.each(ptosTemp, function(index, val) {
						// se o poto atual for ates do ponto clicado
						posAtual = parseFloat(val.posicao);
						posAtual = Math.round(posAtual);

						
						if(posAtual <= posicaoNoCabo){
							ptoAnterior = posAtual;
							objAnt = val;
						}

						//se o ponto atual for maior que o ponto clicado
						if(posAtual > posicaoNoCabo){
							if(!proximoPto){
								proximoPto = posAtual;	
								objProx = val;
							}else{
								//se o ponto atual for maior que o ultimo ponto verificado e esse for maior que o ponto clicado nao faz nada
								if(posAtual > proximoPto){
									return;
								}else{
									//caso seja o primeiro ponto a frente do clicado ele define o ponto como proximo ponto logo depois do ponto clicado
									proximoPto = posAtual;	
									objProx = val;
								}
							}
							
						}
					});

					//caso seja no meio do cabo

					dadosCabo = [];
					dadosCabo['positionMeters'] = posicaoNoCabo;
					dadosCabo['positioning'] = posicaoNoCabo2;
					dadosCabo['cable'] = cable;
					dadosCabo['event'] = event;
					dadosCabo['prevDot'] = objAnt;
					dadosCabo['nextDot'] = objProx;
					d.resolve(dadosCabo);


				}else{

					//funcionando belezinha
					dadosCabo = [];
					if(posicaoNoCabo2 == 'end'){
						dadosCabo['prev_dot'] = cable.dots[cable.dots.length-2]['id'];
						dadosCabo['dot_id'] = cable.dots[cable.dots.length-1]['id'];

						//verificar se ponta está sendo usada
						self.tipCableisUsed(cable.dots[cable.dots.length-1]['id']);

					}else if(posicaoNoCabo2 == 'begin'){
						dadosCabo['next_dot'] = cable.dots[0]['next_dot_id'];
						dadosCabo['dot_id'] = cable.dots[0]['id'];

						//verificar se ponta está sendo usada
						self.tipCableisUsed(cable.dots[0]['id']);
					}

					//caso seja inicio ou fim do cabo				
					dadosCabo['positionMeters'] = posicaoNoCabo;
					dadosCabo['positioning'] = posicaoNoCabo2;
					dadosCabo['cable'] = cable;
					dadosCabo['event'] = event;

					d.resolve(dadosCabo);
				}

				//ponto do cabo encontrado
		 		// return dadosCabo;
		 		d.resolve(dadosCabo);		 		
          	}else{
          		//nao foi possivel encontrar o pondo do cabo
          		// return false;	          		
          		d.resolve(false);
          	}

          	return d.promise;
		},
		

		showAll : function(category){
	        show = false;
	        hide = false
	        switch(category){
	          	case 1:
					//fibra
					if(!self.viewAllCables1){
						self.viewAllCables1 = 1;
						show = true;
					} else{
						hide = true;
						self.viewAllCables1 = 0;
					}
				break;
				case 2:
					//utp
					if(!self.viewAllCables2){
						self.viewAllCables2 = 1;
						show = true;
					} else{
						hide = true;
						self.viewAllCables2 = 0;
					}
				break;
				case 3:
					//cordoalha
					if(!self.viewAllCables3){
						self.viewAllCables3 = 1;
						show = true;
					} else{
						hide = true;
						self.viewAllCables3 = 0;
					}

				default:
				break;
			}

			if(show){
				angular.forEach(self.cables[category],function(el, index){
					el.polyline.setMap(Map.map); 
					el.statusView = 1; 
				});
			}
			if(hide){
				angular.forEach(self.cables[category],function(el, index){
					el.polyline.setMap(null);  
					el.statusView = 0;
				});
			}
		},

		/*
		 * addConfirm function
		 * after the add modal is completed, the "confirm" button calls this function
		 * it takes the data from the modal, and calls the controller to process it and send it to the model to be saved.
		 * */
		addConfirm : function(){
			var dataSend = {};
			coords = {};   
			created_entity = null;
			if (!Map.KmzKmlImporting){
				if (self.block_dbclick_add){
					return;
				}
				self.block_dbclick_add = true;
			}

			
			if(self.editing){
				link = $rootScope.base_url+'/cables/edit';
				dataSend.id = $rootScope.form.id;
				dataSend.name = $rootScope.form.name;
				dataSend.owner = $rootScope.form.owner;
				if ($rootScope.form.cable_type_id != ""){
					//Alterar tipo do cabo
					dataSend.cable_type_id = $rootScope.form.cable_type_id;
					//alterar custo do cabo
	      			angular.forEach(self.cableTypes,function(el, index){
	      				angular.forEach(el,function(cableType, index){
	      					if(cableType.id == $rootScope.form.cable_type_id){
	      						dataSend.cost = cableType.price;
	      						return;                 
	      					}
	      				});
	      			});
				}
			}else{
				if($rootScope.dotsCount < 2){
					$rootScope.message_error_modal = $rootScope.Users.translateText('Você deve selecionar no mínimo dois pontos no mapa');
					$timeout(function() {
						$rootScope.message_error_modal = '';
					}, 3000);
					self.block_dbclick_add = false;
					return;
				}            
				link = $rootScope.base_url+'/cables/add';

				if (!Map.KmzKmlImporting){
	      			angular.forEach($rootScope.dotsTemp,function(val, index){
	      				coord = {};
	      				coord.lat = val.getPosition().lat();
	      				coord.lng = val.getPosition().lng();
	      				//incluindo os ids dos postes e dos pontos de acesso no dot pra usar os existentes
	      				if(val.type == 2 || val.type == 3 || val.type == 4){
	      					coord.id = val.id;
	      				}
	      				coords[index] = coord;            
	      			});
				} else {
	      			angular.forEach($rootScope.dotsTemp,function(val, index){
	      				coord = {};
	      				coord.lat = val.lat;
	      				coord.lng = val.lng;
	      				//incluindo os ids dos postes e dos pontos de acesso no dot pra usar os existentes
	      				//if(val.type == 2 || val.type == 3 || val.type == 4){
	      				//	coord.id = val.id;
	      				//}
	      				coords[index] = coord;            
					  });
				}
				
      			//usar o vetor de coordenadas a serem cadastradas para calcular o tamanho do cabo
    			objCoords = [];
    			$.each(coords, function(index, val) {				
					newDot = new google.maps.LatLng(val.lat,val.lng);
					objCoords.push(newDot);
				});


      			angular.forEach(self.cableTypes,function(el, index){
      				angular.forEach(el,function(cableType, index){
      					if(cableType.id == $rootScope.form.cable_type_id){
      						dataSend.cost = cableType.price;
      						return;                 
      					}
      				});
      			});

      			dataSend.dots = coords;        
      			dataSend.name = $rootScope.form.name;
      			dataSend.owner = $rootScope.form.owner;
      			if (objCoords.length > 1){
      				dataSend.length = Map.calculateLengthObject(objCoords);
      			} else {
      				dataSend.length = 5;
      			}
      			dataSend.cable_type_id = $rootScope.form.cable_type_id;

      			// Add building id, if present in form
      			if ($rootScope.form.building_id){
      				dataSend.building_id = $rootScope.form.building_id;
      				
      				dataSend.building_conn_a_type = $rootScope.form.building_conn_a_type;
      				dataSend.building_conn_a_id = $rootScope.form.building_conn_a_id;
      				dataSend.building_conn_b_type = $rootScope.form.building_conn_b_type;
      				dataSend.building_conn_b_id = $rootScope.form.building_conn_b_id;
      			}
      		}

			if ($rootScope.last_kmz_line){
				last_kmz_line = true;
			} else {
				last_kmz_line = false;
			}
			
			if (Map.KmzKmlImporting){
				KmzKmlImporting = true;
			} else {
				KmzKmlImporting = false;
			}
			
			if ($rootScope.Clients.connecting_client || $rootScope.Buildings.clientConnecting){
				dataSend.drop = true;
			}

			var dotsEncoded = false;
			//Quantidade de dots muito alta causa erro ao salvar. Codificando para enviar no request
			if($rootScope.dotsCount > 450){
				dotsEncoded = JSON.stringify(dataSend.dots);
				dataSend.dots = [];
			}
			
      		$.ajax({
      			url: link,
      			type: 'POST',
      			data: dotsEncoded ? {data:dataSend,dotsEncoded:dotsEncoded} : dataSend,
      			success:function(data){
      				
      				if (!KmzKmlImporting){
						if (self.adding_cordoalha){
							$rootScope.set_errors_modal(data,'cableAddCordoalha');
						} else {
							$rootScope.set_errors_modal(data,'cableAdd');
						}
						setTimeout(function(){
							self.block_dbclick_add = false;
						}, 2000);
      				}
				    
		            if(data.status == 1){
						if(self.editing){
							$rootScope.form = [];
							self.redrawCable(data.id,false);
							if (dataSend.name){
								$rootScope.Nodes.changeNodeName(3, dataSend.id, dataSend.name);
							}
						}else{
							
				      				//adicionar o cabo cadastrado ao vetor
				      				
				      				if(data.id){
				      					created_entity = data.data;
				      					cable = [];
				      					cable.id = created_entity.id;
				      					cable.name = created_entity.name;
				      					cable.category = created_entity.category;
				      					cable.cable_type_id = created_entity.cable_type_id;
				      					cable.deploy_information = created_entity.deploy_information;
				      					cable.cost = created_entity.cost;
				      					cable.owner = created_entity.owner;

				      					// If the cable was added in a building, handle it differently than otherwise
				      					if (created_entity.building_id){
											self.handleBuildingCableAdded(cable, created_entity);
				      					} else {
				      						self.handleMapCableAdded(cable, created_entity);
				      					}
				      				}
				      				if (last_kmz_line){
				      					//If this was a KMZ import call, and it was the last dot, show that the task is completed:
				      					$rootScope.message_success = $rootScope.Users.translateText('Todos os itens KMZ foram importados');
				      					setTimeout(function() {
				      						$rootScope.message_success = '';
				      					}, 4000);
				      					Map.isLoading = false;
				      					$rootScope.last_kmz_line = false;

				      				}
				      			
							
						}
		            }else{
						//usando alert pois quando dava erro não permitia clicar mais no botao confirmar, exigindo recarregar
						alert($rootScope.Users.translateText(data.message));
					}
		         
				},
				complete:function(){
					$rootScope.$digest();
				}
			});
			return created_entity; 
		},

		/**
		 * Handle data from cable that was just added to building
		 * @param {*} cable 
		 * @param {*} created_entity 
		 */
		handleBuildingCableAdded : function(cable, created_entity){
			cable.building_id = created_entity.building_id;
			cable.building_conn_a_type = created_entity.building_conn_a_type;
			cable.building_conn_a_id = created_entity.building_conn_a_id;
			cable.building_conn_b_type = created_entity.building_conn_b_type;
			cable.building_conn_b_id = created_entity.building_conn_b_id;
			console.log(cable);
			angular.forEach($rootScope.Buildings.buildings, function(building, idx){
				if (building.id == created_entity.building_id){
					if (!building.cables){
						building.cables = [];
					}
					building.cables.push(cable);
					// If the building is open, redraw cable paths, and unset the blinking client
					if ($rootScope.Buildings.buildingOpen.id == building.id){
						$rootScope.Buildings.drawCableSvgs(building.cables);
						if ($rootScope.Buildings.clientConnecting){
							$rootScope.Buildings.clientConnecting.drop_cable_id = created_entity.id;
							$rootScope.Buildings.clientConnecting.connecting = false;
							$rootScope.Buildings.clientConnecting = null;
						}
					}
				}
			});
		},

		/**
		 * Handle data from cable that was just added to map
		 * 
		 * @param {*} cable 
		 * @param {*} created_entity 
		 */
		handleMapCableAdded : function(cable, created_entity){
			path = [];
			dots = [];
			for (var index = 0; index < created_entity.dots.length; index++) {
				var pto = created_entity.dots[index];
				path.push({ lat: parseFloat(pto.lat), lng: parseFloat(pto.lng) });
				dot = Map.drawMarker(pto.lat, pto.lng, pto.id, 'marker.png', String(pto.id), '', 0);
				dot.id = pto.id;
				dot.next_dot_id = pto._joinData.next_dot_id;
				dot.cableId = cable.id;
				if ((cable.client === null || typeof cable.client === "undefined") && pto.clients.length > 0) {
					dot.client = pto.clients[0];
					cable.client = pto.clients[0];
				}
				dot.index = index;
				Map.addListenerDotCable(dot);
				dots.push(dot);
			}
			cable.dots = dots;
			//descobrir a cor dependendo do tipo
			angular.forEach(self.cableTypes, function (type, index) {
				angular.forEach(type, function (tp, index) {
					if (tp.id == cable.cable_type_id) {
						cor = tp.color;
						cable.type_name = tp.name;
						cable.current_type_price = tp.price;
					}
				});
			});
			if (cable.category == 4) {
				//Draw thinner line, if it's a DROP cable
				poly = Map.drawPolyline(path, cable.name, cor, false, true);
			} else {
				poly = Map.drawPolyline(path, cable.name, cor, false);
			}
			poly.setMap(Map.map);

			cable.polyline = poly;

			Map.addListenerCable(cable);

			switch (cable.category) {
				case 1:
					self.cables[1].push(cable);
					break;
				case 2:
					self.cables[2].push(cable);
					break;
				case 3:
					self.cables[3].push(cable);
					break;
				case 4:
					self.cables[4].push(cable);
					$rootScope.Clients.setClientCable(cable.client.id, cable.id, 4, self.cables[4].length - 1);
					break;
				default:
					break;
			}
			if ((cable.category != 4) && (cable.category != 3)) {
				self.addCableTreeView(created_entity.id, created_entity.name, self.cables[cable.category].length - 1, cable.category);
			}
		},

		/**
		 * 
		 * Gets suggested dots for drop cable path from the backend
		 * based on the Google Maps Directions API
		 * 
		 * @param {*} client 
		 * @param {*} access_point 
		 */
		getGMDotsSuggestion : function(client, access_point){
			let dotsSuggestion = [];
			let dataSend = {
				dot_a: {
					id: client.dot.id,
					lat: client.dot.lat,
					lng: client.dot.lng,
				},
				dot_b: {
					id: access_point.dot.id,
					lat: access_point.dot.position.lat(),
					lng: access_point.dot.position.lng(),
				}
			};
			let link = $rootScope.base_url + "/cables/get_drop_dots";
			$.ajax({
				url: link,
				type: "POST",
				data: dataSend,
				async: false,
				success:function(data){
					dotsSuggestion = data.data;
				}
			});
			return dotsSuggestion;
		},

		/**
		 * Add drop cable method
		 * Creates a cable between the client and the access point, with two dots between, for editing.
		 * 
		 * @parameters 
		 * 	client - all the client data
		 * 	access_point - all the ap data
		 * 
		 * @return void
		 * */
		addDropCable : function(client, access_point, in_building){
			$rootScope.dotsTemp = [];
			//If it's not in a building, create the dots for the DROP cable
			if (!in_building){
				// Get drop cable path suggestion from backend
				let dotsSuggestion = self.getGMDotsSuggestion(client, access_point);
				dotsSuggestion.forEach(dot => {
					let drop_dot = Map.drawMarker(dot.lat, dot.lng,"","marker.png","Guia","");
					if (typeof dot.id !== "undefined"){
						drop_dot.id = dot.id;
						if (dot.id == access_point.dot.id){
							// Type 2 for access point dot
							drop_dot.type = 2;
							if(access_point.sharedDatabase){
								delete drop_dot.id;
							}
						} else if (dot.id == client.dot.id){
							// Type 4 for client dot
							drop_dot.type = 4;
						}
					}
					$rootScope.dotsTemp.push(drop_dot);
				});
			} else {
				// Add a single dot to the cable - the building dot
				console.log($rootScope.Buildings.buildingOpen);
				building_dot = ap_dot = Map.drawMarker($rootScope.Buildings.buildingOpen.dot.lat, $rootScope.Buildings.buildingOpen.dot.lng,'','marker.png','Guia','');
				$rootScope.dotsTemp.push(building_dot);
				
				// Set the building id on the cable
				$rootScope.form.building_id = $rootScope.Buildings.buildingOpen.id;
				
				// Set the client and access point ids on the cable
				// Access Point
				$rootScope.form.building_conn_a_type = 1;
				$rootScope.form.building_conn_a_id = access_point.id;
				// Client
				$rootScope.form.building_conn_b_type = 2;
				$rootScope.form.building_conn_b_id = client.id;
			}
			
			$rootScope.form.name = "DROP";
			$rootScope.form.cable_type_id = self.dropCableTypeId;
			$rootScope.dotsCount = 2;

			if(access_point.sharedDatabase){
				self.block_dbclick_add = false;
			}

			self.addConfirm();
		},
		
		/**
		 * Add cable in building method
		 * 
		 * Adds a cable in to a building, based on the form data
		 * */
		addCableInBuilding : function(){
			        
			link = $rootScope.base_url+'/cables/add_in_building';
			
			// Iniciar dados do cabo
			var dataSend = {};
			dataSend.name = $rootScope.form.name;
			dataSend.cable_type_id = $rootScope.form.cable_type_id;
			dataSend.length = 5;
			
			// Buscar custo por metro do cabo
			angular.forEach(self.cableTypes,function(el, index){
				angular.forEach(el,function(cableType, index){
					if(cableType.id == $rootScope.form.cable_type_id){
						dataSend.cost = cableType.price;
						return;                 
					}
				});
			});

			// Add building id, if present in form
			if ($rootScope.form.building_id){
				dataSend.building_id = $rootScope.form.building_id;
				dataSend.building_conn_a_type = $rootScope.form.building_conn_a_type;
				dataSend.building_conn_a_id = $rootScope.form.building_conn_a_id;
				dataSend.building_conn_b_type = $rootScope.form.building_conn_b_type;
				dataSend.building_conn_b_id = $rootScope.form.building_conn_b_id;
			}

			$.ajax({
				url: link,
				type: 'POST',
				data: dataSend,
				success:function(data){
					// Early return when it fails
					if(!data.status){
						// Process errors
						return;
					}

					var data = data.data;

					if(data.id){
						cable = [];
						cable.id = data.id;
						cable.name = data.name;
						cable.category = data.category;
						cable.cable_type_id = data.cable_type_id;
						cable.deploy_information = data.deploy_information;
						cable.cost = data.cost;

						// Cable was added in a building, so it is handled differently than otherwise
						cable.building_id = data.building_id;
						cable.building_conn_a_type = data.building_conn_a_type;
						cable.building_conn_a_id = data.building_conn_a_id;
						cable.building_conn_b_type = data.building_conn_b_type;
						cable.building_conn_b_id = data.building_conn_b_id;
						
						// Put the added cable in the right building array
						angular.forEach($rootScope.Buildings.buildings, function(building, idx){
							if (building.id == data.building_id){
								if (!building.cables){
									building.cables = [];
								}
								building.cables.push(cable);
								// If the building is open, redraw cable paths, and unset the blinking client
								if ($rootScope.Buildings.buildingOpen.id == building.id){
									$rootScope.Buildings.drawCableSvgs(building.cables);
								}
							}
						});
						
						// Close adding modal
						$rootScope.Buildings.cancelAddBuilding();
						self.block_dbclick_add = false;
					}
				},
				complete:function(){
					$rootScope.$digest();
				}
			})  
		},

		
		/**
		 * Get dot at method
		 * Gets the dot that lies at "d" distance between "v" and "u" points
		 * 
		 * @parameters
		 * 	v_x - x value of the v point
		 * 	v_y - y value of the v point
		 * 	u_x - x value of the u point
		 * 	u_y - y value of the u point
		 * 	d - distance
		 * 
		 * @return 
		 * 	array containing the new dot, in the variables lat and lng
		 * */
		getDotAt : function(v_x, v_y, u_x, u_y, d){
			/* Equations to solve:
			 * v-u = z
			 * z * d = w
			 * v - w = x
			 * return x
			 * */
			// v - u = z
			z_x = v_x - u_x;
			z_y = v_y - u_y;
			// z * d = w
			w_x = z_x * d;
			w_y = z_y * d;
			// v - w = x
			x_x = v_x - w_x;
			x_y = v_y - w_y;
			
			dot = [];
			dot.lat = x_x;
			dot.lng = x_y;
			return dot;
		},
		
		merge_with_ap : function(data){
			if(data.access_point.dot.id != data.cable.dot.id){
	            $.ajax({
	                url: $rootScope.base_url+'/cables/merge_with_ap',
	                type: 'POST',
	                data: data ,
	                success:function(response){

						if(response.status === 1){
		               		angular.forEach($rootScope.AccessPoints.accessPoints, function(accessPoints,indexType){
	                          	angular.forEach(accessPoints, function(accessPoint,index){
		                           if(accessPoint.dot.id == data.access_point.dot.id){
		                           		accessPoint.dot.id = data.cable.dot.id;
		                           		pos = new google.maps.LatLng(data.cable.dot.lat,data.cable.dot.lng);
		                           		accessPoint.dot.setPosition(pos);
		                           }
	                            })
	                        });

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
		               	self.editing = false;
		               	self.redrawCable(data.cable.id,false);
		               	$rootScope.AccessPoints.refreshAccessPoint(data.access_point.id);
		                $rootScope.$digest(); 
	                }
	            })   
            }
		},

		editPolyline : function(cable){
			if(!cable){
				cable = self.cableSelected;
			}
			if (self.editing && (cable.id != self.editing_cable.id)){
				return;
			}			
        	if(cable.editing){
        		angular.forEach(cable.dots, function(dot,index){
        			dot.setMap(null);
        			dot.setDraggable(null);
        			cable.editing = false;
        		});
        		self.editing = false;
        		self.editing_cable = null;
        	}else{   
        		if($rootScope.menuCable){
        			dialogService.close('menuCable');  
        			$rootScope.menuCable = false;
        		} 
        		angular.forEach(cable.dots, function(dot,index){
        			dot.setMap(Map.map);
        			dot.setDraggable(true);
        			cable.editing = true;
        		});
        		self.editing = true;
        		self.editing_cable = cable;
        	}
		},

		/**
		 * Desliga editar cabo ao executar qualquer outra tarefa
		 */
		offEditCablePolyline : function(){
			if(self.editing){
				for(dot of self.editing_cable.dots){
        			dot.setMap(null);
        			dot.setDraggable(null);
        			cable.editing = false;
				}
				self.editing = false;
        		self.editing_cable = null;
			}
		},

		edit : function(id,category){

			model = []; 
			$rootScope.form = [];
			$rootScope.form.error = [];

			if(!self.bulkEdit){

				self.compileManufacturers();
				self.compileFiberNumbers();
				self.cableTypesAddFiltered = self.cableTypesAdd.slice();
				//Prefilter it with the default filter, if there is one
				$timeout(function(){
					if ($rootScope.DefaultValues.cable_manufacturer){
						$rootScope.form.add_list_manufacturer = $rootScope.DefaultValues.cable_manufacturer.str_value;
						self.updateCableList();	        		
					}
				},100);

				self.editing = true;
				
				if(!id || !self.editing){
					if(self.cableSelected){
						$rootScope.form = self.cableSelected;
					}else{								
						angular.forEach(self.cables[category],function(el,index){
							if(el.id == id){
								$rootScope.form = el;
								return;
							} 
						});  					
					}	
				}else{
					//encontrar o cabot dentro dos vetores
					angular.forEach(self.cables[category],function(el,index){
						if(el.id == id){
							$rootScope.form = el;
							return;
						} 
					});  
				}
			}else{
				self.bulkCategory = category;
				$rootScope.Nodes.getTreeViewFolders();
				
				// Load cable types data for bulk edit
				self.compileManufacturers();
				self.compileFiberNumbers();
				self.cableTypesAddFiltered = self.cableTypesAdd.slice();
			}
			
			var options = {
				autoOpen: false,
				modal: true,
				title: $rootScope.Users.translateText('Editar cabo'),
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
				create: function (event, ui) {
					$(event.target).parent().css('position', 'fixed');
				},   
				close:function(){
					self.editing = false;   
					$rootScope.form = [];
					$rootScope.menuCable = false;

					if(self.bulkEdit){
						self.bulkEdit = false;
                        self.bulkDeploy = false;
						self.bulkUndeploy = false;
                        $rootScope.dotsCount = $rootScope.dotsTemp.length;
					}

				}    
			};
			self.editing = true;    
			if($rootScope.menuCable){
				dialogService.close("menuCable");  
			}

			dialogService.open("cableAdd","cableAdd", model, options).then(function() {
				setTimeout(function() {
					$("#select-folder-cables").selectize();
				}, 1000);
			});

			// Forcing cable type to be selected
			// TODO - This shouldn't be necessary, look deeper into it
			$timeout(function(){
				document.getElementById("cable-add-type-select").value = $rootScope.form.cable_type_id;
				$rootScope.$apply();
			},50);
			
		},

        bulkEditConfirm : function(){

			self.isLoading = true;
			$rootScope.$evalAsync();
			var cont = 0;

			var cable1 = $rootScope.Cables.cables[1].filter(obj =>  $rootScope.RegionReports.anyPointInsideQuick(obj, $rootScope.shapeTemp, 10));
			var cable2 = $rootScope.Cables.cables[2].filter(obj =>  $rootScope.RegionReports.anyPointInsideQuick(obj, $rootScope.shapeTemp, 10));
			//juntar arrays
            var cables = [...cable1,...cable2];
            
            if(cables.length === 0){
            	$rootScope.message_error_modal = $rootScope.Users.translateText("Tipo não encontrado");
				self.isLoading = false;
				return;
			}
			
			// Check if cable type is being changed and has fewer fibers - NOT ALLOWED
			if ($rootScope.form.cable_type_id) {
				var newCableType = self.cableTypesAdd.find(t => t.id == $rootScope.form.cable_type_id);
				
                var invalidReduction = false;
                cables.forEach(cable => {
                    if(!cable.polyline.map){
                        return; // ignora cabos não visíveis no mapa
                    }
                    var currentFibers = null;
                    if (cable.cable_type && cable.cable_type.number_fibers){
                        currentFibers = cable.cable_type.number_fibers;
                    } else if (cable.cable_type_id){
                        var curType = self.cableTypesAdd.find(t => t.id == cable.cable_type_id);
                        if (curType){
                            currentFibers = curType.number_fibers;
                        }
                    }
                    if (currentFibers && currentFibers > newCableType.number_fibers){
                        invalidReduction = true;
                    }
                });

                if (invalidReduction){
                    $rootScope.message_error_modal = $rootScope.Users.translateText("O novo tipo de cabo possui menos fibras que pelo menos um dos cabos selecionados. Operação bloqueada.");
                    $timeout(function(){ $rootScope.message_error_modal = ''; }, 4000);
                    self.isLoading = false;
                    return;
                }
			}
			
			var arrItems = {};
			var contIndex = 0;

			cables.forEach(cable =>{
				
				//verifica se o item está visivel
				if(!cable.polyline.map){
					return;
				}

				var item = {};
				$rootScope.form.error = [];

				if ($rootScope.form.name){
				    item.name = $rootScope.form.name;
				    cable.name = $rootScope.form.name;
				}
				if ($rootScope.form.owner){  
				    item.owner = $rootScope.form.owner;
				    cable.owner = $rootScope.form.owner;
				}
				
				// Bulk cable type update
				if ($rootScope.form.cable_type_id){
				    item.cable_type_id = $rootScope.form.cable_type_id;
				    cable.cable_type_id = $rootScope.form.cable_type_id;
				    cable.cable_type = newCableType;
				}
                
                item.changeDeployed = false;
                
                //deploys
                if(self.bulkUndeploy && cable.deploy_information.deployed){
                	item.changeDeployed = true;
                    item.deployed = false;
					cable.deploy_information.deployed = false;
				}else if(self.bulkDeploy && !cable.deploy_information.deployed){
					item.changeDeployed = true;
                    item.deployed = true;
					cable.deploy_information.deployed = true;
                }

				item.changeFolder = false;

				if ($('#select-folder-cables').val()){
					
					var node = [];
					
					if(node = $rootScope.Nodes.nodes.find(n=>n.cable_id === cable.id)){
						item.node_id = node.id;
						item.parent_id = parseInt($('#select-folder-cables').val());
	                    item.changeFolder = true;
					}					
                    
                }
                
                item.id = cable.id;

				arrItems[contIndex] = item;
				contIndex++;
        
            });

            edit_many(arrItems);

            function edit_many(items) {
				self.isLoading = true;
				var dataSend = JSON.stringify(items);          
				$.ajax({
					url: $rootScope.base_url+'/cables/edit_many',
					type: 'POST',
					data: {data:dataSend},
					dataType: "json",
					success:function(data){
						if(data.status == 1){

							$rootScope.message_success_modal = data.message;
                            self.isLoading = false;
                            // Atualiza cabos editados em memória
                            angular.forEach(items, function(it){
                                if(it && it.id){
                                    $rootScope.Cables.redrawCable(it.id,false);
                                }
                            });
                            // Fecha modal e encerra modo bulk
                            self.addCancel();
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

		addCancel : function(){

			if(self.bulkEdit){
				self.bulkEdit = false;
				self.bulkDeploy = false;
				self.bulkUndeploy = false;
				$rootScope.dotsCount = $rootScope.dotsTemp.length;
				$rootScope.message_success_modal = '';
				$rootScope.message_error_modal = '';
				$rootScope.Regions.addCancel();
				$rootScope.$apply();
				dialogService.close('cableAdd');
			}else{

				if($rootScope.dotsCount>0){
					angular.forEach($rootScope.dotsTemp,function(val,index){
						val.setMap(null);
					});
					$rootScope.cableTemp.setMap(null);
				}

				$rootScope.tempPath = [];
				$rootScope.dotsTemp = [];
				$rootScope.cableTemp = [];
				$rootScope.dotsCount = 0;
				$rootScope.form = [];
				$rootScope.form.error = [];
				$rootScope.finalizar = false;
				if (self.adding_cordoalha){
					dialogService.close('cableAddCordoalha');
				} else {
					dialogService.close('cableAdd');
				}
				self.adding = false;
				self.adding_cordoalha = false;

			}
		},

		focus : function(category,index){
			self.cablesItemMenu[category][index].polyline.setMap(Map.map);
			self.cablesItemMenu[category][index].statusView = 1;
			Map.setCenter(self.cablesItemMenu[category][index].dots[0].getPosition().lat(),self.cablesItemMenu[category][index].dots[0].getPosition().lng(),15);
		},

		view : function(category,index){
			if(self.cablesItemMenu[category][index].polyline.getMap()){
				self.cablesItemMenu[category][index].polyline.setMap(null);
				self.cablesItemMenu[category][index].statusView = 0;
			}else{
				self.cablesItemMenu[category][index].polyline.setMap(Map.map);
				self.cablesItemMenu[category][index].statusView = 1;
				Map.setCenter(self.cablesItemMenu[category][index].dots[0].getPosition().lat(),self.cablesItemMenu[category][index].dots[0].getPosition().lng(),15);
			}
		},

		itemInManufacturerArray : function(manufacturer, array_manufacturers){
			var i;
			for (i = 0; i < array_manufacturers.length + 1; i++){
				if (array_manufacturers[i]){
					if (array_manufacturers[i].toLowerCase() == manufacturer.toLowerCase()){
						return true;
					}
				}
			}
			return false;
		},
		
		compileManufacturers : function(){
			self.TypeManufacturers = [];
			angular.forEach(self.cableTypesAdd, function(type, type_idx){
				if ((type.manufacturer != "") && (!self.itemInManufacturerArray(type.manufacturer, self.TypeManufacturers))){
					self.TypeManufacturers.push(type.manufacturer);
				}
			});
		},
		
		
		itemInFibersArray : function(number_fibers, array_number_fibers){
			var i;
			for (i = 0; i < array_number_fibers.length + 1; i++){
				if (array_number_fibers[i] == number_fibers){
					return true;
				}
			}
			return false;
		},
		
		compileFiberNumbers : function(){
			self.TypeNumberFibers = [];
			angular.forEach(self.cableTypesAdd, function(type, type_idx){
				if ((type.number_fibers > 0) && (!self.itemInFibersArray(type.number_fibers, self.TypeNumberFibers))){
					self.TypeNumberFibers.push(type.number_fibers);
				}
			});
			self.TypeNumberFibers = self.TypeNumberFibers.sort(function(a, b) {
			    return parseInt(a) - parseInt(b);
			});
		},
		
		updateCableList : function(){
			self.cableTypesAddFiltered = self.cableTypesAdd.slice();
			
			//Both filters are set to show all
			if ((($rootScope.form.add_list_manufacturer == 'all') || (!$rootScope.form.add_list_manufacturer)) && (($rootScope.form.add_list_number_fibers == 'all') || (!$rootScope.form.add_list_number_fibers))){
				return;
			}
			
			//Filter by manufacturer
			if (($rootScope.form.add_list_manufacturer) && ($rootScope.form.add_list_manufacturer != 'all')){
				$rootScope.DefaultValues.editCableManufacturer($rootScope.form.add_list_manufacturer);
				var new_array = [];
				angular.forEach(self.cableTypesAddFiltered, function(type, idx){
					if (type.manufacturer.toLowerCase() == $rootScope.form.add_list_manufacturer.toLowerCase()){
						new_array.push(type);
					}
				});
				self.cableTypesAddFiltered = [];
				self.cableTypesAddFiltered = new_array.slice();
			}
			
			//Filter by fiber numbers
			if (($rootScope.form.add_list_number_fibers) && ($rootScope.form.add_list_number_fibers != 'all')){
				var new_array = [];
				angular.forEach(self.cableTypesAddFiltered, function(type, idx){
					if (type.number_fibers == $rootScope.form.add_list_number_fibers){
						new_array.push(type);
					}
				});
				self.cableTypesAddFiltered = [];
				self.cableTypesAddFiltered = new_array.slice();
			}
		},

		 add : function(){
			self.offEditCablePolyline();
	  		if(self.adding){
	  			self.adding = false;
	            self.addCancel();
	        }else{
	        	self.compileManufacturers();
	        	self.compileFiberNumbers();
	        	self.cableTypesAddFiltered = self.cableTypesAdd.slice();
	        	//Prefilter it with the default filter, if there is one
	        	$timeout(function(){
		        	if ($rootScope.DefaultValues.cable_manufacturer){
		        		$rootScope.form.add_list_manufacturer = $rootScope.DefaultValues.cable_manufacturer.str_value;
		        		self.updateCableList();	        		
		        	}
	        	},100);
	        	
	        	//If another cable is being edited, cancel that action...
	        	if (self.editing){
            		self.editing = false;
	        	}
	        	var options = {
	        		autoOpen: false,
	        		modal: false,
	        		title: $rootScope.Users.translateText('Adicionar cabo'),
	        		width: 360,
	        		height:'auto',
	        		resizable:false,
	        		dialogClass: "noclose", 
	        		dialogClass: "noclose no-scroll", 
	        		position: {
	        			my: "right top",
	        			at: "right-10 top+80",
	        			of: window,
	        			collision: "none"
	        		},
	        		create: function (event, ui) {
	        			$(event.target).parent().css('position', 'fixed');
	        		},
	        		close:function(){
	        			self.addCancel();
	        			self.cableTypesAdd = [];
	        			angular.forEach(self.cableTypes[1], function(type, index_type){
	        				self.cableTypesAdd.push(type);
	        			});
	        			angular.forEach(self.cableTypes[2], function(type, index_type){
	        				self.cableTypesAdd.push(type);
	        			});
	        		}
	        	};
	        	model = [];  
	        	$rootScope.dotsCount = 0;
				self.adding = true;
				self.block_dbclick_add = false;
	        	$rootScope.form = [];
	        	$rootScope.form.error = [];          
	        	dialogService.open('cableAdd','cableAdd', model, options).then();
	        }
		},

		addCordoalha : function(){
			dialogService.close('menuPost');
	  		if(self.adding_cordoalha){
	  			//self.adding = false;
	            //self.addCancel();
	        }else{	        	
	        	//If another cable is being edited, cancel that action...
	        	if (self.editing){
            		self.editing = false;
	        	}
	        	var options = {
	        		autoOpen: false,
	        		modal: false,
	        		title: $rootScope.Users.translateText('Adicionar cordoalha'),
	        		width: 360,
	        		height:'auto',
	        		resizable:false,
	        		dialogClass: "noclose", 
	        		dialogClass: "noclose no-scroll", 
	        		position: {
	        			my: "right top",
	        			at: "right-10 top+80",
	        			of: window,
	        			collision: "none"
	        		},
	        		create: function (event, ui) {
	        			$(event.target).parent().css('position', 'fixed');
	        		},
	        		close:function(){
	        			self.addCancel();
	        			self.cableTypesAdd = [];
	        		}
	        	};
	        	model = [];  
	        	$rootScope.dotsCount = 0;
	        	self.adding = true;
	        	self.adding_cordoalha = true;
	        	$rootScope.form = [];
	        	$rootScope.form.error = [];          
	        	dialogService.open('cableAddCordoalha','cableAddCordoalha', model, options).then();
	        }
		},

        cableHasError : function(cableId){
            for (let i = 0; i < self.cableErrors.length; i++) {
                if (self.cableErrors[i].cable_id == cableId){
                    return true;
                }
            }
            return false;
        },

        /**
         * Load all cable errors
         */
        getCableErrors : function(){
            link = $rootScope.base_url+'/cables/get_cable_errors'
			$.ajax({
				url: link,
				type: 'POST',
				success:function(data){
                    console.log("Cable errors:", data);
                    self.cableErrors = data;
                }
            });
        },

		typeList : function(list_cables){
			var d = $q.defer();
			self.cableTypes[1] = [];
			self.cableTypes[2] = [];
			self.cableTypes[3] = [];
			self.cableTypes[4] = [];
			self.cableTypesAdd = [];
			self.isLoading = true;
			link = $rootScope.base_url+'/cable_types/list_all'
			$.ajax({
				url: link,
				type: 'POST',
				success:function(data){      

					//angular.forEach(data,function(el, index){
						for (var i = 0; i < data.length; i++){
							var el = data[i]; 
							self.cableTypes[el.category].push(el);
							if((el.category != 3) && (el.category != 4)){
								self.cableTypesAdd.push(el);	
							}
							if (el.category == 4){
								self.dropCableTypeId = el.id;
							}
							if (el.category == 3){
								self.cableCordoalhaTypes.push(el);
							}
							d.resolve();
						}
						//},function(){
						//	d.resolve();	
						//});
					if(list_cables){
						self.list(false);
					}
				}				
			}) 
			return d.promise;
		},

		colorCodesList : function(){
			var d = $q.defer();
			self.isLoading = true;
			link = $rootScope.base_url+'/color_codes/list_all';
			$.ajax({
				url: link,
				type: 'POST',
				success:function(data){ 

					$rootScope.AccessPoints.colorCode = [];
					$rootScope.Connections.tubeColorCode = [];
					$rootScope.Fusions.codeColor = [];

					$rootScope.Fusions.codeColor[0] = ["grey"];
					
					for(code of data){
						
						$rootScope.AccessPoints.colorCode[code.id] = [...[[]], ...JSON.parse(code.aps_color_code_json)];
						$rootScope.Connections.tubeColorCode[code.id] = [...["null"], ...JSON.parse(code.connections_color_code_json)];
						$rootScope.Fusions.codeColor[code.id] = [...["null"], ...JSON.parse(code.fusions_color_code_json)];

					}
					
					d.resolve();
				}				
			}); 
			return d.promise;
		},



		list : function(show){
			self.cables = [];
			self.cables[1] = [];//fibra
			self.cables[2] = [];//utp
			self.cables[3] = [];//cordoalha
			self.cables[4] = [];//DROP
			self.isLoading = true;
			link = $rootScope.base_url+'/cables/list_all'
			$.ajax({
				url: link,
				type: 'POST',
				success:function(response){
					self.cables_loaded_width = response.percentage + "%";
                	$rootScope.$apply();
					
					self.organize_cable_data(response.data, show);
					if (response.all_data_loaded){
						self.isLoading = false;
						//After listing all, notify treeview nodes service
						$rootScope.Nodes.everythingLoaded("Cables");
					} else {
						//There was too much data to get in one request, so start incremental load now.
                		self.list_incrementally(response.offset, show);
					}
				},
				complete:function(){
					
					$rootScope.$digest();
					
				}
			});
		},
		
		list_incrementally : function(offset, show){
			link = $rootScope.base_url+'/cables/list_all'
			$.ajax({
				url: link,
				data: {offset : offset},
				type: 'POST',
				success:function(response){
					self.cables_loaded_width = response.percentage + "%";
                	$rootScope.$apply();
					
					self.organize_cable_data(response.data, show);
					if (response.all_data_loaded){
						self.isLoading = false;
						//After listing all, notify treeview nodes service
						$rootScope.Nodes.everythingLoaded("Cables");

                        // @bruno - 10/01/2021 - Desabling server cache for now
						// Send an extra request to cache all the cables
						// cache_link = $rootScope.base_url+'/cables/cache_all'
						// $.ajax({
						// 	url: cache_link,
						// 	type: 'POST',
						// 	success:function(response){}
						// });
					} else {
						//There was too much data to get in one request, so start incremental load now.
                		self.list_incrementally(response.offset);
					}
				},
				complete:function(){
					$rootScope.$digest();
				}
			});
		},
		
		/**
		 * Organize Cable Data method
		 * Takes the array of cables received, and organized each cables' data, 
		 * and copies it into the array of the proper category
		 * */
		organize_cable_data : function(data, show){
			//angular.forEach(data,function(el, index){
				for (var index = 0; index < data.length; index++){
					var el = data[index];
					if(el.cable_type_id){
						cable = [];
						cable.id = el.id;
						cable.name = el.name;
						cable.category = el.category;
						cable.cable_type_id = el.cable_type_id;
						cable.deploy_information = el.deploy_information;
						cable.cost = el.cost;
						cable.owner = el.owner;

						if(el.sharedDatabase){
							cable.sharedDatabase = el.sharedDatabase;
						}

						path = [];
						dots = [];
						for (var i = 0; i < el.dots.length; i++){
							var pto = el.dots[i];             
							path.push({lat:parseFloat(pto.lat),lng:parseFloat(pto.lng)});                              
							dot = Map.drawMarker(pto.lat, pto.lng,pto.id,'marker.png',String(pto.id),'',0);
							dot.id = pto.id;
							dot.next_dot_id = pto._joinData.next_dot_id;
							dot.cableId = el.id;
							if ((cable.client === null || typeof cable.client === "undefined") && pto.clients.length > 0){
								dot.client = pto.clients[0];
								cable.client = pto.clients[0];
							}
							dot.index = i;
							Map.addListenerDotCable(dot);
							dots.push(dot);
						};
						cable.dots = dots;
						
						//descobrir a cor dependendo do tipo
						if(!el.sharedDatabase){
							
							//angular.forEach(self.cableTypes, function(type,index){
							for (var i = 1; i < self.cableTypes.length; i++){
								//angular.forEach(type, function(tp,index){
								for (var j = 0; j < self.cableTypes[i].length; j++){
									var tp = self.cableTypes[i][j]; 
									if(tp.id == cable.cable_type_id){

										//montar array para toggle de tipos de cabo
										if((cable.category === 1 || cable.category === 2)
											&& !self.arrCableTypes.find(t=>t.id === tp.id)){

											self.arrCableTypes.push(tp);
											
										}
										
										cor = tp.color;  
										cable.type_name = tp.name;
										cable.current_type_price = tp.price;
									}
								};
							};

						}else{

							cor = el.cable_type.color;  
							cable.type_name = el.cable_type.name;
							cable.current_type_price = el.cable_type.price;

						}

						if (cable.category == 4){
							//Draw thinner line, if it's a DROP cable
							poly = Map.drawPolyline(path, el.name, cor, cable.deploy_information.deployed, true);
						} else {
							poly = Map.drawPolyline(path, el.name, cor, cable.deploy_information.deployed);
						}
						if(show && $rootScope.user_data.user_setting.show_cables){
							poly.setMap(Map.map);
						}else{
							poly.setMap(null);
						}
						
						cable.polyline = poly;
	
						Map.addListenerCable(cable);
	
						switch(el.category){
							case 1:
								self.cables[1].push(cable);
								break;
							case 2:
								self.cables[2].push(cable);
								break;
							case 3:
								self.cables[3].push(cable);
								break;
							case 4:
								self.cables[4].push(cable);
								if (cable.client){
									//comentando pois ja é feito no list_all dos clientes
									//$rootScope.Clients.setClientCable(cable.client.id, cable.id, 4, self.cables[4].length - 1);
								}
								break;
							default:
								break;
						}
					}
				};
		},

		deleteCable : function(id, category) {
			var options = {
					autoOpen: false,
					modal: true,
					title: $rootScope.Users.translateText('Atenção'),
					width: 300,
					height:'auto',
					resizable:true,
					dialogClass: "noclose", 
			};
			model = [];  
			$rootScope.cable_id = id;                    
			$rootScope.cableCategory= category;
			dialogService.open('cableDelete','cableDelete', model, options).then();
		},

		deleteConfirm : function(id, category, synchronous){
			self.isLoading = true;
			var async = true;
			var set_errors = true;
			var success = true;
			if (synchronous){
				async = false;
				set_errors = false;
			}

			link = $rootScope.base_url+'/cables/delete';
			$.ajax({
				url: link,
				type: 'POST',
				data: {id:id},
				async: async,
				success:function(data){
					if (set_errors){
						$rootScope.set_errors_modal(data,'cableDelete');
					}
					if(data.status == 1){
						angular.forEach(self.cables[category],function(el,index){
							if(el.id == id){
								el.polyline.setMap(null);
								self.cables[category].splice(index,1);
								if($rootScope.menuCable){
									$rootScope.dialogService.close('menuCable');  
								}     
								return;
							} 
						});  
						self.removeCableFromTreeView(id);
					} else {
						success = false;
					}
				},
				complete:function(){
					self.isLoading = false;
					$rootScope.$digest();
				}
			});
			return success;
		},
		
		deleteDropCable : function(id){
			self.isLoading = true;
			link = $rootScope.base_url+'/cables/delete_drop';
			$.ajax({
				url: link,
				type: 'POST',
				data: {id:id},
				success:function(data){
					if(data.status == 1){
						angular.forEach(self.cables[4],function(el,index){
							if(el.id == id){
								if ($rootScope.Buildings.buildingOpen){
									// Delete a cable that's in a building
									angular.forEach($rootScope.Buildings.buildingOpen.cables, function(cable, idx){
										if (cable.id == id){
											$rootScope.Buildings.buildingOpen.cables.splice(idx);
											$rootScope.Buildings.drawCableSvgs($rootScope.Buildings.buildingOpen.cables);
										}
									});
								} else {
									// Delete a regular cable, on the map
									el.polyline.setMap(null);
									self.cables[4].splice(index,1);
								}
							}
						});
					}
				},
				complete:function(){
					self.isLoading = false;		
					$rootScope.$digest();
				}
			});  
		},
		
		/**
		 * Delete building cable method
		 * deletes a cable in a building
		 * */
		deleteBuildingCable : function(id){
			self.isLoading = true;
			link = $rootScope.base_url+'/cables/delete';
			$.ajax({
				url: link,
				type: 'POST',
				data: {id:id},
				success:function(data){
					if(data.status == 1){
                        let buildingCables = [];
						angular.forEach($rootScope.Buildings.buildingOpen.cables,function(el, index){
                            if (el.id !== id){
                                buildingCables.push(el);
                            }
						});
                        $rootScope.Buildings.drawCableSvgs(buildingCables);
					}
				},
				complete:function(){
					self.isLoading = false;		
					$rootScope.$digest();
				}
			});  
		},
		
		showCableNameFunc : function(name, event){
			//Set Value
			self.hover_cable_name = name;
			
    		page_coords = Map.getEventPageXY(event);
    		pageX = page_coords.pageX;
    		pageY = page_coords.pageY;
			//Set Position
    		$('.cable-name-div').css({
    			left: pageX + 5,
	    		top: pageY + 5
    		});
			//Set visible
			self.showCableName = true;  
			$rootScope.$apply();
		},
		
		hideCableName : function(){
			//Unset visible
			self.showCableName = false;  
			//unset value
			self.hover_cable_name = null;
			$rootScope.$apply();
		},
		
		addCableTreeView : function(id, name, tomo_index, tomo_type_index){
			node_data = {};
			node_data.parent_id = $rootScope.Nodes.saving_node_id;
			node_data.leaf = 1;
			node_data.selected = 1;
			node_data.checked = 1;
			node_data.category = 3;
			node_data.cable_id = id;
			
			var tomo_node_id = $rootScope.Nodes.addSync(node_data);
			
			var icon = $rootScope.base_url + '/img/icons_map/cable.svg';
			$rootScope.Nodes.addNoteToTree(id, tomo_node_id, $rootScope.Nodes.saving_node_id, icon, name, 3, tomo_index, tomo_type_index);
		},
		
		removeCableFromTreeView : function(cable_id){
			//Remove node from DB
			var remove_node_id = null;
			var i;
			for (i = 0; i < $rootScope.Nodes.nodes.length; i++){
				if ($rootScope.Nodes.nodes[i].cable){
					if ($rootScope.Nodes.nodes[i].cable_id == cable_id){
						remove_node_id = $rootScope.Nodes.nodes[i].id;
					}
				}else if($rootScope.Nodes.nodes[i].data){ //se o cabo for deletado logo após ter sido criado
					if ($rootScope.Nodes.nodes[i].data.cable_id == cable_id){
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
		
		getTotalLength : function(cable){
			let total_length = 0;
			link = $rootScope.base_url+'/cables/get_total_length';
			$.ajax({
				url: link,
				type: 'GET',
				async: false,
				data: {cable_id: cable.id},
				success:function(data){
					if(data){
						total_length = data;
					}
				},
				complete:function(){
				}
			})
			return total_length;	
		},
		
		apOnCable : function(ap, cable){
			var i;
			for (i = 0; i < cable.dots.length; i++){
				if (cable.dots[i].id == ap.dot.id){
					return true;
				}
			}
			return false;
		},
		
		apOnCableEnd : function(ap, cable){
			link = $rootScope.base_url+'/access_point_connections/get_specific';
			var onEnd;
			$.ajax({
				url: link,
				type: 'POST',
				async: false,
				data: {
					access_point_id: ap.id,
					cable_id: cable.id
				},
				success:function(data){
					if (data.length > 1){
						onEnd = false;
					} else {
						onEnd = true;
					}
				},
				complete:function(){
				}
			})  
			return onEnd;
		},
		
		toggleAllCordoalhas : function(){
			if(!self.viewAllCordoalhas){
				//Mostrar tudo
				angular.forEach(self.cables[3], function(cable, idx){
					cable.polyline.setMap(Map.map);
				});
				self.viewAllCordoalhas = true;
			} else {
				//Esconder tudo
				angular.forEach(self.cables[3], function(cable, idx){
					cable.polyline.setMap(null);
				});
				self.viewAllCordoalhas = false;
			}
		},
		
		/**
		 * Is extremity method
		 * 
		 * Checks if a dot is the first or last dot in a cable.
		 * Returns true if thats the case, false otherwise.
		 * */
		isExtremity : function(dot){
			// If it is the last dot, next_dot_id will be null
			if (!dot.next_dot_id){
				// Return the code "2" for end of cable
				return 3;
			}
			
			// Find cable
			var cable = null;
			for (var i = 0; i < self.cables.length; i++){
				if (self.cables[i]){
					for (var j = 0; j < self.cables[i].length; j++){
						if (self.cables[i][j].id == dot.cableId){
							cable = self.cables[i][j];
							break;
						}
					}
					if (cable){
						break;
					}
				}
			}
			
			// Check if it's the first dot in the cable
			// If any other dot points to the current one, it's not an extremity
			for (var i = 0; i < cable.dots.length; i++){
				if (cable.dots[i].next_dot_id == dot.id){
					return false;
				}
			}
			
			// If the code got here, it's the first dot.
			// Return the code "1" for beggining of cable
			return 1;
		},
		
		/**
		 * Get Cable from Dot method
		 * */
		getCableFromDot : function(dot){
			// Find cable
			var cable = null;
			for (var i = 0; i < self.cables.length; i++){
				if (self.cables[i]){
					for (var j = 0; j < self.cables[i].length; j++){
						if (self.cables[i][j].id == dot.cableId){
							cable = self.cables[i][j];
							break;
						}
					}
					if (cable){
						break;
					}
				}
			}
			return cable;
		},

		rename : function(id,new_name){

			var dataSend = {};
			dataSend.id = id;
			dataSend.name = new_name;
	
			link = $rootScope.base_url+"/cables/edit";
				
			$.ajax({
					url: link,
					type: "POST",
					data: dataSend,
					success:function(data){
						
						$rootScope.Cables.redrawCable(id, false);
						
					}});
	
		},

		/*cableIsOnMap : function(cable_id){
			angular.forEach(self.cables,function(cableType,indexType){
				angular.forEach(cableType,function(cable,indexThis){
					if(cable.id == cable_id){
						if(cable.polyline.map){
							$rootScope.Reserves.setCableShownStatus(true);
							return true;
						}else{		
							$rootScope.Reserves.setCableShownStatus(false);
							return false;
						}
					}
				});
			});
		}*/

		cableIsOnMap : function(cable_id){
			var cable = null;
			var cableType = null;
			for(var i = 0 ; i < self.cables.length ; i++){
				if (self.cables[i]){
					cableType = self.cables[i];
					for(var j = 0 ; j < cableType.length ; j++){
						cable = cableType[j];
						if(cable.id == cable_id){
							if(cable.polyline.map){
								return true;
							}else{
								return false;
							}
						}
					}
				}
			}
		}
		
	}



	return self;


})