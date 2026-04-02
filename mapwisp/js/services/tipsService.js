/** 
 * Tip Service
 * 
 * Contains the methods and data for all hopscotch tip we create in MAPWISP.
 */
app.service("Tips", function (dialogService, Translation, Users, $rootScope) {
	var self = {

        newApLayoutTip: {
			id: "new-ap-layout-tip",
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
					target: "hopscotch-new-ap",
					title: "Novo Layout de Caixas",
					content: "Clique aqui para utilizar o novo Layout de caixas. Este layout está em fase de testes, em breve novas funcionalidades serão adicionadas.",
					placement: "left",
					onShow: function () {
						//Send event to analytics
						if ($rootScope.run_analytics){
							ga("send", {
								hitType: "event",
								eventCategory: "NewLayout",
								eventAction: "Got new layout presented",
								eventLabel: "Got new layout presented"
							});
						}
					}
				}
			]
		},

        showNewApLayoutTip: function(){
            hopscotch.startTour(self.newApLayoutTip);
        },

		// Opens a window with offer tip of day.
		offerTip: function () {

			//Send event to analytics
			if ($rootScope.run_analytics) {
				ga("send", {
					hitType: "event",
					eventCategory: "Tips",
					eventAction: "Offer tip",
					eventLabel: "Offer tip"
				});
			}

			var options = {
				autoOpen: false,
				modal: true,
				resizable: false,
				width: 600,
				height: "auto",
			};
			model = [];
			$rootScope.dialogService.open('offerTip', 'offerTip', model, options).then();
		},

		getTips : function(){
			link = $rootScope.base_url+'/painel/get_tips'
			$.ajax({
				url: link,
				type: 'POST',
				success:function(data){
					if(data['status']){
						$rootScope.Tips.tip = data;
					}
				},
				complete:function(){
				   $rootScope.$apply();
				}
			});  
		},

		changeShowTips : function(showTips){
			link = $rootScope.base_url+'/Profiles/edit'
			$.post(link, 
				{
					user_setting:
					{
						show_tips: showTips ? false : true,
					}
				},
				function(data) {			
					$rootScope.$apply();					
				}
			); 
		},
	}

	return self;

});