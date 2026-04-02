/**
 * Markers Service
 * 
 * Funcoes gerais para markers. Serve para centralizar o manuseio de markers
 * (mostrar no mapa, esconder do mapa, adicionar ao MarkerClusterer)
 * 
 * */

/**
 * Cria um SuperClusterAlgorithm com query limitada ao viewport (+ padding),
 * em vez de processar todos os markers do mundo inteiro.
 * Tambem detecta mudancas de viewport (pan) para re-renderizar.
 */
function createViewportSuperCluster(maxZoom, radius) {
    var algo = new markerClusterer.SuperClusterAlgorithm({
        maxZoom: maxZoom,
        radius: radius || 120
    });
    var lastBoundsKey = "";

    var origCluster = algo.cluster.bind(algo);
    algo.cluster = function (input) {
        var map = input.map;
        var bounds = map.getBounds();
        var zoom = Math.round(map.getZoom());

        if (bounds) {
            var sw = bounds.getSouthWest();
            var ne = bounds.getNorthEast();
            var padLat = (ne.lat() - sw.lat()) * 0.5;
            var padLng = (ne.lng() - sw.lng()) * 0.5;

            return algo.superCluster
                .getClusters([
                    sw.lng() - padLng,
                    sw.lat() - padLat,
                    ne.lng() + padLng,
                    ne.lat() + padLat
                ], zoom)
                .map(algo.transformCluster.bind(algo));
        }

        return origCluster(input);
    };

    var origCalculate = algo.calculate.bind(algo);
    algo.calculate = function (input) {
        var result = origCalculate(input);

        var bounds = input.map.getBounds();
        if (bounds) {
            var boundsKey = bounds.toUrlValue(3);
            if (!result.changed && lastBoundsKey !== boundsKey) {
                lastBoundsKey = boundsKey;
                algo.clusters = algo.cluster(input);
                return { clusters: algo.clusters, changed: true };
            }
            lastBoundsKey = boundsKey;
        }

        return result;
    };

    return algo;
}

/**
 * Cria um renderer de cluster usando SVG inline (sem request de rede).
 * Muito mais leve que usar PNGs carregados do servidor.
 */
function createClusterRenderer(fillColor, strokeColor) {
    return {
        render: function (cluster, stats) {
            var count = cluster.count;
            var position = cluster.position;

            var size = Math.min(22 + Math.log2(count) * 6, 52);

            var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '">' +
                '<circle cx="' + (size / 2) + '" cy="' + (size / 2) + '" r="' + (size / 2 - 2) + '" ' +
                'fill="' + fillColor + '" fill-opacity="0.85" ' +
                'stroke="' + (strokeColor || '#ffffff') + '" stroke-width="2"/>' +
                '</svg>';

            var half = size / 2;

            return new google.maps.Marker({
                position: position,
                icon: {
                    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
                    scaledSize: new google.maps.Size(size, size),
                    anchor: new google.maps.Point(half, half)
                },
                label: {
                    text: String(count),
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: "bold"
                },
                zIndex: 1000 + count
            });
        }
    };
}

app.service("Markers", function($rootScope, Map, $timeout, LevelsAndModes){
	var self = {
		generalMarkerCluster : null,
        postsMarkerCluster : null,
        clientsMarkerCluster : null,
        reservesMarkerCluster : null,
        allClusters : [],
        dirtyClusters : [],

        generalMaxZoom : 14,
        postsMaxZoom : 18,
        clientsMaxZoom : 16,
        reservesMaxZoom : 16,
		
		init : function(){
			if(LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_COMERCIAL])){
				self.generalMaxZoom = 13;
			}

			$timeout(function(){
				self.generalMarkerCluster = new markerClusterer.MarkerClusterer({
					map: Map.map,
					markers: [],
					algorithm: createViewportSuperCluster(self.generalMaxZoom, 120),
                    renderer: createClusterRenderer("#4CAF50")
				});
                self.allClusters.push(self.generalMarkerCluster);
			},1000);

			$timeout(function(){
				self.postsMarkerCluster = new markerClusterer.MarkerClusterer({
					map: Map.map,
					markers: [],
					algorithm: createViewportSuperCluster(self.postsMaxZoom, 120),
                    renderer: createClusterRenderer("#78909C")
				});
                self.allClusters.push(self.postsMarkerCluster);
			},1000);

			$timeout(function(){
				self.clientsMarkerCluster = new markerClusterer.MarkerClusterer({
					map: Map.map,
					markers: [],
					algorithm: createViewportSuperCluster(self.clientsMaxZoom, 120),
                    renderer: createClusterRenderer("#1E88E5")
				});
                self.allClusters.push(self.clientsMarkerCluster);
			},1000);

			$timeout(function(){
				self.reservesMarkerCluster = new markerClusterer.MarkerClusterer({
					map: Map.map,
					markers: [],
					algorithm: createViewportSuperCluster(self.reservesMaxZoom, 120),
                    renderer: createClusterRenderer("#78909C")
				});
                self.allClusters.push(self.reservesMarkerCluster);
			},1000);
		},
		
		addToMap : function(marker, cluster){
			if (typeof cluster === "undefined") {
				cluster = self.generalMarkerCluster;
			}
			if (!cluster || !marker){
				return;
			}
			self.isLoading = true;
            $timeout(function(){
                cluster.addMarker(marker, true);
                marker.tomoIsOnMap = true;
                self.markDirty(cluster);
            }, 0);
		},
		
		removeFromMap : function(marker, cluster){
			if (typeof cluster === "undefined") {
				cluster = self.generalMarkerCluster;
			}
			if (!cluster || !marker){
				return;
			}
			self.isLoading = true;
            $timeout(function(){
                cluster.removeMarker(marker, true);
                marker.tomoIsOnMap = false;
                self.markDirty(cluster);
            }, 0);
		},

		markDirty : function(cluster){
			if (self.dirtyClusters.indexOf(cluster) === -1) {
				self.dirtyClusters.push(cluster);
			}
			$timeout.cancel(self.redraw_timeout);
			self.redraw_timeout = $timeout(function(){
				self.isLoading = false;
				self.dirtyClusters.forEach(function(c) {
					if (c && typeof c.render === "function") {
						c.render();
					}
				});
				self.dirtyClusters = [];
				if (!$rootScope.$$phase) {
					$rootScope.$apply();
				}
			}, 500);
		},
		
		markerOnMap : function(marker){
            return marker.tomoIsOnMap;
		}
	};
	
	return self;
});