/**
 * @author Bruno Pauls
 * @description The LevelsAndModes service provides methods that
 * check if the current user has specific access levels, or if
 * the user is currently in any specific visualizing mode
 *
 *
	examples:
	LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR, LevelsAndModes.levels.NIVEL_TECNICO]);
	LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_VIEW]);

 */

/* globals app, levelsEnum, modesEnum */
app.service('LevelsAndModes', function(Users, $rootScope){
	var self = {

		// Niveis
		levels : new levelsEnum(),

		// Modos
		modes : new modesEnum(),

		nullOrEmpty : function(array){
			if (array == null){
				return true;
			}
			if (array.length === 0){
				return true;
			}
			return false;
		},

		/**
		 * Is Level method
		 *
		 * @param levelArray array containing all levels to compare
		 * @returns boolean true if user leve is in levelArray
		 */
		isLevel : function(levelArray){
			if (self.nullOrEmpty(levelArray)){
				return true;
			}
			return levelArray.includes(Users.getLevel());
		},

		/**
		 * Is Mode method
		 *
		 * @param modeArray array containing all modes to compare
		 * @returns boolean true if user visualizing mode is in modeArray
		 */
		isMode : function(modeArray){
			if (self.nullOrEmpty(modeArray)){
				return true;
			}
			return modeArray.includes(Users.getMode());
		}
	}

	// Se coloca no rootScope na hora que é inicializado.
	// Dessa forma o sevico fica acessivel universalmente. Necessario para permissoes.
	$rootScope.levelsAndModes = self;

	return self;
});
