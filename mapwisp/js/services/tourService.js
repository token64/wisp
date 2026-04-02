/** 
 * Tour Service
 * 
 * Contains the methods and data for all hopscotch tours we create in MAPWISP.
 */
app.service("Tour", function (dialogService, Translation, Users, $rootScope) {
	var self = {

		/*-----------------------------------
		TOUR DATA
		-----------------------------------*/

		// Tour completa inicial, com passos básicos
		// Para usuario administrador e tecnico
		intro_tour_complete: {
			id: "iniciando-tour",
			showPrevButton: "true",
			i18n: {
				nextBtn: "Próximo",
				prevBtn: "Anterior",
				doneBtn: "Finalizar",
				skipBtn: "Pular",
				closeTooltip: "Fechar",
			},
			steps: [
				{
					target: "tour-regiao",
					title: "Adicionar Região",
					content: 'Clicando aqui você poderá adicionar uma nova região no mapa. Veja esse video com detalhes: <a target="_blank" href="https://www.youtube.com/watch?v=V_pbfqqpi_A">Regiões</a>',
					placement: "bottom"
				},
				{
					target: "tour-cabo",
					title: "Adicionar Cabo",
					content: "Clique agora no botão indicado para uma tour específica para adicionar um cabo no mapa.",
					placement: "bottom",
					nextOnTargetClick: true,
					showNextButton: false
				},
				{
					target: "tour-cable-add-confirm",
					title: "Salvar Cabo",
					content: "Preenchemos o formulário acima pra você. Se preferir, pode alterar os dados. Agora clique no mapa desenhando a rota do novo cabo. Quando terminar, clique em 'Confirmar'.",
					placement: "bottom",
					nextOnTargetClick: true,
					showNextButton: false,
					onShow: function () {
						self.fillCableData();
					},
					xOffset: -170,
					arrowOffset: 170
				},
				{
					target: "map_container",
					title: "Salvar Cabo",
					content: "Perfeito! Agora clique com o botão direito em cima do cabo, e depois clique em 'Próximo' aqui no tour.",
					placement: "left",
					xOffset: 170,
					yOffset: 150
				},
				{
					target: "tour-menu-cable-add-cx-emenda",
					title: "Adicionar Caixa de Emendas",
					content: "Agora clique no botão indicado para adicionar uma caixa de emendas",
					nextOnTargetClick: true,
					showNextButton: false,
					placement: "bottom",
					xOffset: -15
				},
				{
					target: "tour-add-cx-emenda",
					title: "Salvar Caixa de Emendas",
					content: "Preenchemos o formulário acima pra você. Se preferir, pode alterar os dados. Quando terminar, clique em 'Confirmar'.",
					placement: "bottom",
					nextOnTargetClick: true,
					showNextButton: false,
					onShow: function () {
						self.fillCxEmendasData();
					},
				},
				{
					target: "map_container",
					title: "Abrir caixa de emendas",
					content: "Agora clique na nova caixa de emendas para abrir ela. Quando estiver aberta, clique em 'Próximo' aqui no tour.",
					placement: "left",
					xOffset: 170,
					yOffset: 150
				},
				{
					target: "tour-access-point-controls",
					title: "Ações na caixa de emendas",
					content: "Deixe o mouse em cima de qualquer botão para ver o que ele faz",
					placement: "bottom",
				},

				
				{
					target: "tour-ap-connection-left",
					title: "Conexões",
					content: "Essa é a conexão do cabo que você acabou de criar, com esta caixa. Cada fibra é mostrada na sua cor de acordo com o padrão de cores escolhido no tipo de cabo. Cada fibra tem os botões com as ações da fibra, como 'Remover', escolher entre 'Passagem' e 'Emenda', etc.",
					placement: "top",
				},
				
				{
					target: "containerAccessPoint",
					title: "Fechar a Caixa de Emendas",
					content: "Clique agora no botão vermelho para fechar esta caixa. Depois clique em 'Próximo' aqui no tour.",
					placement: "left",
					xOffset: 1170,
					yOffset: -50
				},
				{
					target: "map_container",
					title: "Rota Completa",
					content: "Essa é a base para criar rotas no MAPWISP. Agora continuaremos com as outras ações no mapa.",
					placement: "left",
					xOffset: 170,
					yOffset: 150
				},
				{
					target: "tour-regua",
					title: "Régua",
					content: 'Clicando aqui você poderá medir a distância entre pontos que marcar no mapa. Veja esse video com detalhes: <a target="_blank" href="https://www.youtube.com/watch?v=-TJxf7fS_GE">Régua</a>',
					placement: "bottom"
				},
				{
					target: "tour-itens",
					title: "Adicionar Itens em Série",
					content: 'Clicando aqui você poderá adicionar vários itens em seguida no mapa. Veja esse video com detalhes: <a target="_blank" href="https://www.youtube.com/watch?v=LfklUxNeNZM">Adicionar itens em série</a>',
					placement: "bottom"
				},
				{
					target: "tour-kml",
					title: "Importar KML",
					content: "Clicando aqui você poderá importar arquivos KML para a sua conta MAPWISP.",
					placement: "bottom"
				},
				{
					target: document.querySelector("#jstree-sidebar-div"),
					title: "Menu TreeView",
					content: 'Aqui ficam os seus itens do mapa e as suas pastas. Com um clique com o botão direito você poderá criar uma nova pasta. Com um duplo clique em uma pasta voce define esta pasta como ativa, e os itens criados são direcionados automáticamente para ela. Veja esse video com mais detalhes: <a target="_blank" href="https://www.youtube.com/watch?v=AJNLHakNt8Y">Menu TreeView</a>',
					placement: "right"
				},
				{
					target: document.querySelector("div.row:nth-child(3)"),
					title: "Buscar Nodo",
					content: "Aqui você poderá pesquisar as pastas e os itens adicionados no mapa pelo nome.",
					placement: "right"
				},
				{
					target: document.querySelector("div.row:nth-child(2)"),
					title: "Botões dos itens do menu lateral",
					content: "Clicando nesses botões você poderá esconder ou mostrar categorias de itens nas pastas abaixo.",
					placement: "bottom"
				},
				{
					target: document.querySelector(".map-toggles"),
					title: "Botões dos itens do mapa",
					content: "Clicando nesses botões você poderá esconder ou mostrar elementos do mapa.",
					placement: "bottom"
				},
				{
					target: document.querySelector("ul.left:nth-child(2) > li:nth-child(2)"),
					title: "Mostrar/Esconder TreeView",
					content: "Clicando aqui você poderá minimizar e expandir o menu lateral",
					placement: "bottom"
				},
				{
					target: document.querySelector(".has-dropdown"),
					title: "Menu",
					content: "Aqui você encontrará as opções para criar seus próprios itens para o mapa e gerenciar os elementos já criados.",
					placement: "bottom",
					onNext: function () {
						$("#menuprofilebutton").click();
					}
				},
				{
					target: "tour-tutorials",
					title: "Tutoriais",
					content: "Aqui voce encontra tutoriais sobre como usar as ferramentas do MAPWISP",
					placement: "left",
					onNext: function () {
						$("#menuprofilebutton").click();
					},
					onPrev: function () {
						$("#menuprofilebutton").click();
					}
				},
			]
		},

		// Tour inicial, com passos básicos
		// para usuario view e comercial
		intro_tour_view_comercial: {
			id: "iniciando-tour-view-comercial",
			showPrevButton: "true",
			i18n: {
				nextBtn: "Próximo",
				prevBtn: "Anterior",
				doneBtn: "Finalizar",
				skipBtn: "Pular",
				closeTooltip: "Fechar",
			},
			steps: [
				{
					target: "tour-regua",
					title: "Régua",
					content: 'Clicando aqui você poderá medir a distância entre pontos que marcar no mapa. Veja esse video com detalhes: <a target="_blank" href="https://www.youtube.com/watch?v=-TJxf7fS_GE">Régua</a>',
					placement: "bottom"
				},
				{
					target: document.querySelector("#jstree-sidebar-div"),
					title: "Menu TreeView",
					content: 'Aqui ficam os seus itens do mapa e as suas pastas. Com um clique com o botão direito você poderá criar uma nova pasta. Com um duplo clique em uma pasta voce define esta pasta como ativa, e os itens criados são direcionados automáticamente para ela. Veja esse video com mais detalhes: <a target="_blank" href="https://www.youtube.com/watch?v=AJNLHakNt8Y">Menu TreeView</a>',
					placement: "right"
				},
				{
					target: document.querySelector("div.row:nth-child(3)"),
					title: "Buscar Nodo",
					content: "Aqui você poderá pesquisar as pastas e os itens adicionados no mapa pelo nome.",
					placement: "right"
				},
				{
					target: document.querySelector("div.row:nth-child(2)"),
					title: "Botões dos itens do menu lateral",
					content: "Clicando nesses botões você poderá esconder ou mostrar categorias de itens nas pastas abaixo.",
					placement: "bottom"
				},
				{
					target: document.querySelector(".map-toggles"),
					title: "Botões dos itens do mapa",
					content: "Clicando nesses botões você poderá esconder ou mostrar elementos do mapa.",
					placement: "bottom"
				},
				{
					target: document.querySelector("ul.left:nth-child(2) > li:nth-child(2)"),
					title: "Mostrar/Esconder TreeView",
					content: "Clicando aqui você poderá minimizar e expandir o menu lateral",
					placement: "bottom"
				},
				{
					target: document.querySelector(".has-dropdown"),
					title: "Menu",
					content: "Aqui você encontrará as opções para criar seus próprios itens para o mapa e gerenciar os elementos já criados.",
					placement: "bottom",
					onNext: function () {
						$("#menuprofilebutton").click();
					}
				},
				{
					target: "tour-tutorials",
					title: "Tutoriais",
					content: "Aqui voce encontra tutoriais sobre como usar as ferramentas do MAPWISP",
					placement: "left",
					onNext: function () {
						$("#menuprofilebutton").click();
					},
					onPrev: function () {
						$("#menuprofilebutton").click();
					}
				},
			]
		},

		// One step tour, just to show where to start the actual tour later
		start_later: {
			id: "start-later-tour",
			showPrevButton: "false",
			i18n: {
				nextBtn: "Próximo",
				prevBtn: "Anterior",
				doneBtn: "OK",
				skipBtn: "Pular",
				closeTooltip: "Fechar",
			},
			steps: [
				{
					target: "tour-iniciar-tour",
					title: "Iniciar tour mais tarde",
					content: "A qualquer momento voce pode iniciar a tour clicando nesse botao",
					placement: "left",
					onShow: function () {
						//Send event to analytics
						if ($rootScope.run_analytics){
							ga("send", {
								hitType: "event",
								eventCategory: "Tour",
								eventAction: "take_tour_later",
								eventLabel: "Chose to take tour later"
							});
						}
					}
				}
			]
		},

		/*-----------------------------------
		TOUR METHODS
		-----------------------------------*/

		/**
		 * Fill Caixa de Emendas Data
		 * 
		 * Fill the "AccessPointAdd" form data for the user during the tour
		 */
		fillCxEmendasData: function () {
			setTimeout(function () {
				self.writeWithDelay($rootScope.form, "name", "NOME_CAIXA_EMENDAS_TOUR");
				let types = $rootScope.AccessPoints.accessPointTypes;
				for (key in types) {
					if ((($rootScope.accessPointCategory != 3) && (types[key].category == $rootScope.accessPointCategory))
						|| (($rootScope.accessPointCategory == 3) && (Cables.cableSelected.category != 1) && (types[key].category == $rootScope.accessPointCategory))
						|| (($rootScope.accessPointCategory == 3) && (Cables.cableSelected.category == 1) && (types[key].pon))) {
						$rootScope.form.access_point_type_id = types[key].id;
						break;
					}
				}

				console.log("Selected: ", $rootScope.form.access_point_type_id);
				$rootScope.$apply();
			}, 20);
		},

		/**
		 * Fill Cable Data
		 * 
		 * Fill the "CableAdd" form data for the user during the tour
		 */
		fillCableData: function () {
			self.writeWithDelay($rootScope.form, "name", "NOME_CABO_TOUR");
			self.writeWithDelay($rootScope.form, "owner", "PROP_CABO_TOUR");
			$rootScope.form.cable_type_id = $rootScope.Cables.cableTypesAddFiltered[0].id;
			$rootScope.$apply();
		},



		/**
		 * Write with Delay
		 * 
		 * Writes the "value" to a specific property "variable" in an object "obj"
		 * character by character, with a delay.
		 * 
		 * This is to provide a visual effect during the tour
		 */
		writeWithDelay: function (obj, variable, value) {
			obj[variable] = "";
			for (let i = 0; i < value.length; i++) {
				setTimeout(function () {
					obj[variable] = obj[variable] + value.charAt(i);
					$rootScope.$apply();
				}, i * 40);
			}
		},

		// This method is only called on the first login of any user.
		// Opens a window with a welcome message, and offers the tour.
		offerTour: function () {
			// Mostrar janela inicial pra decidir se faz tour ou nao
			var options = {
				autoOpen: false,
				modal: false,
				resizable: false,
				dialogClass: "no-header no-scroll",
				width: 550,
				height: 250,
			};
			model = [];
			$rootScope.dialogService.open('offerInitTour', 'offerInitTour', model, options).then();
		},

		// This opens a window initializing the tour
		startInitialTour: function (startedFromMenu) {
			if (startedFromMenu){
				//Send event to analytics
				if ($rootScope.run_analytics){
					ga("send", {
						hitType: "event",
						eventCategory: "Tour",
						eventAction: "init_tour_from_menu",
						eventLabel: "Started Tour from Top Map Menu"
					});
				}
			}

			// Mostrar janela inicial pra decidir se faz tour ou nao
			var options = {
				autoOpen: false,
				modal: false,
				resizable: false,
				dialogClass: "no-header no-scroll",
				width: 550,
				height: 310,
			};
			model = [];
			$rootScope.dialogService.open('initTourFirstStep', 'initTourFirstStep', model, options).then();
		},

		// After the first window of the tour (initTourFirstStep), this method is called
		// to start thje actual hopscotch tour
		startInitHopscotchTour: function () {
			$rootScope.dialogService.close('initTourFirstStep');
			if (Users.getLevel() === $rootScope.levelsAndModes.levels.NIVEL_ADMINISTRADOR
				|| Users.getLevel() === $rootScope.levelsAndModes.levels.NIVEL_TECNICO) {
				// Complete tour for levels administrador and tecnico
				self.translateTour(self.intro_tour_complete);
				hopscotch.startTour(self.intro_tour_complete);
				//Send event to analytics
				if ($rootScope.run_analytics){
					ga("send", {
						hitType: "event",
						eventCategory: "Tour",
						eventAction: "init_tour",
						eventLabel: "Complete Tour"
					});
				}
			} else if (Users.getLevel() === $rootScope.levelsAndModes.levels.NIVEL_VIEW
				|| Users.getLevel() === $rootScope.levelsAndModes.levels.NIVEL_COMERCIAL
                || Users.getLevel() === $rootScope.levelsAndModes.levels.NIVEL_VIEWEXPORT) {
				// Shoreter tour for levels comercial and view
				self.translateTour(self.intro_tour_view_comercial);
				hopscotch.startTour(self.intro_tour_view_comercial);
				//Send event to analytics
				if ($rootScope.run_analytics){
					ga("send", {
						hitType: "event",
						eventCategory: "Tour",
						eventAction: "init_tour",
						eventLabel: "Comercial User Tour"
					});
				}
			} else if (Users.getLevel() === $rootScope.levelsAndModes.levels.NIVEL_MONITOR) {
				// TODO TOUR PARA MONITOR
			}
		},

		// This tour is started if the user chooses not to start the tour on his first login.
		// Only one stem is shown, pointing to the button where the tour can be started later.
		showStartLater: function () {
			$rootScope.dialogService.close('offerInitTour');
			// TODO Find better way to open this menu
			// (Foundation Dropdown menu)
			$("#menuprofilebutton").click();
			self.translateTour(self.start_later);
			hopscotch.startTour(self.start_later);
		},

		// Translates a tour from its original language - PT-BR
		// to the current language that the user configured 
		translateTour: function (tourObject) {
			tourObject.i18n.nextBtn = Translation.translateText(tourObject.i18n.nextBtn);
			tourObject.i18n.prevBtn = Translation.translateText(tourObject.i18n.prevBtn);
			tourObject.i18n.doneBtn = Translation.translateText(tourObject.i18n.doneBtn);
			tourObject.i18n.skipBtn = Translation.translateText(tourObject.i18n.skipBtn);
			tourObject.i18n.closeTooltip = Translation.translateText(tourObject.i18n.closeTooltip);
			for (var step in tourObject.steps) {
				tourObject.steps[step].title = Translation.translateText(tourObject.steps[step].title);
				tourObject.steps[step].content = Translation.translateText(tourObject.steps[step].content);
			}
		}

	}

	return self;

});