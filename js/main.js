(function(window, document, google, gapi, undefined) {
    var map, service, infowindow;
    var location = new google.maps.LatLng(-22.0087080, -47.8909260);
    var VIEW_ID = '131117389';

    var options = {
        center: location,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        scrollwheel: false,
        clickableIcons: false,
        zoomControl: false,
        mapTypeControl: false,
        scaleControl: false,
        streetViewControl: false,
        rotateControl: false,
        fullscreenControl: false,
        zoom: 16,
    };

    map = new google.maps.Map(document.getElementById('map'), options);
    service = new google.maps.places.PlacesService(map);
    infowindow = new google.maps.InfoWindow();

    google.maps.event.addDomListener(window, 'resize', resize);
    google.maps.event.trigger(map, 'resize');

    function onSignIn(googleUser) {
        var profile = googleUser.getBasicProfile();

        document.querySelector('.sk-overlay.google').classList.add('hidden');
        document.getElementById('user').innerHTML = profile.getName();

        document.body.classList.add('loader'); // loader
        queryReports();
    }

    function resize() {
        var center = map.getCenter();
        google.maps.event.trigger(map, 'resize');
        map.setCenter(center);
    }

    function queryReports() {
        gapi.client.request({
            path: '/v4/reports:batchGet',
            root: 'https://analyticsreporting.googleapis.com/',
            method: 'POST',
            body: {
                reportRequests: [
                    {
                        viewId: VIEW_ID,
                        dateRanges: [
                            {
                                startDate: 'today',
                                endDate: 'today'
                            }
                        ],
                        metrics: [
                            {
                                expression: 'ga:totalEvents'
                            }
                        ],
                        dimensions: [
                            {
                                name: 'ga:eventCategory'
                            },
                            {
                                name: 'ga:eventAction'
                            },
                            {
                                name: 'ga:eventLabel'
                            }
                        ],
                        dimensionFilterClauses: [
                            {
                                filters: [
                                    {
                                        dimensionName: 'ga:eventCategory',
                                        operator: 'EXACT',
                                        expressions: ['Marker']
                                    },
                                    {
                                        dimensionName: 'ga:eventAction',
                                        operator: 'EXACT',
                                        expressions: ['click']
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        }).then(displayResults, console.error.bind(console));
    }

    function displayResults(response) {
        var rows = response.result.reports[0].data.rows;
        var data = [];

        for (var i = rows.length - 1; i >= 0; i--) {
            var dimensions = rows[i].dimensions;
            var metrics = rows[i].metrics;

            var event = new Event(
                dimensions[0],
                dimensions[1],
                dimensions[2],
                parseInt(metrics[0].values[0])
            );

            data.push(event);
        }

        var types = data[0].eventLabel.split(', ').filter(function(value) {
            return value != 'point_of_interest' && value != 'establishment';
        });

        findPOI(types);
    }

    function findPOI(types) {
        var request = {
            location: location,
            radius: '1000',
            types: types
        }

        console.log(request);

        service.nearbySearch(request, processResults);
    }

    function processResults(results, status, pagination) {
        if (status !== google.maps.places.PlacesServiceStatus.OK) {
            return;
        } else {
            createMarkers(results);

            if (pagination.hasNextPage) {
                pagination.nextPage();
            } else {
                document.body.classList.remove('loader'); // loader
            }
        }
    }

    function createMarkers(places) {
        var bounds = new google.maps.LatLngBounds();

        for (var i = 0, place; place = places[i]; i++) {
            var image = {
                url: place.icon,
                size: new google.maps.Size(71, 71),
                origin: new google.maps.Point(0, 0),
                anchor: new google.maps.Point(17, 34),
                scaledSize: new google.maps.Size(25, 25)
            };

            var marker = new google.maps.Marker({
                map: map,
                icon: image,
                title: place.name,
                position: place.geometry.location,
                types: place.types
            });

            google.maps.event.addListener(marker, 'click', function() {
                var self = this;

                var template = '<div><strong>' + self.title + '</strong>'
                 + '<br><span>types: ' + self.types.join(', ') + '</span</div>';

                infowindow.setContent(template);
                infowindow.open(map, self);

                ga('send', 'event', 'Marker', 'click', self.types.join(', '));
            });

            bounds.extend(place.geometry.location);
        }

        map.fitBounds(bounds);
    }

    function Event(eventCategory, eventAction, eventLabel, totalEvents) {
        this.eventCategory = eventCategory;
        this.eventAction = eventAction;
        this.eventLabel = eventLabel;
        this.totalEvents = totalEvents;
    }

    window.onSignIn = onSignIn;
})(window, document, window.google, window.gapi);
