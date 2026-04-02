/**
 * tomo-levels directive
 *
 * Mostra ou esconde um elemento no mapa de acordo com
 * o nivel de acesso e modo de visualização do usuário atual
 */
app.directive('tomoLevels', function($rootScope, $parse) {
    return function(scope, element, attrs) {
		function renderField(){
			var attributes = $parse(attrs.tomoLevels)(scope);
			var isLevel = $rootScope.levelsAndModes.isLevel(attributes.levels);
			var isMode = $rootScope.levelsAndModes.isMode(attributes.modes);
			var display = isLevel && isMode;
			element.css('display', display ? '' : 'none');
		}

		// Reagindo aos eventos de usuario carregado e modo de visualizacao do
		// usuario atualizado para renderizar o elemento
		$rootScope.$on('tomoevent:currentUserLoaded', renderField());  // Porque as vezes so executa esse?
		$rootScope.$on('tomoevent:currentUserLoaded', renderField);
		$rootScope.$on('tomoevent:userViewModeUpdated', renderField);
    };
});

