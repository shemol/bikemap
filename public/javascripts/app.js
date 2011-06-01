/* Core Application Code */
var $_ = $_ || {};

(function() {
  var seattle = new google.maps.LatLng(47.6063889, -122.3308333);
  var geocoder = new google.maps.Geocoder();
  var map;
  var renderer;

  var DEFAULT_ORIGIN = seattle;
  var DEFAULT_DESTINATION = new google.maps.LatLng(47.61079236060622, -122.34237670898438);
  
    function clearError ( el ) {
        $(el).removeClass("status-error");
    }

    function displayError ( el, message ) {
        $(".errorMessage", el).html(message);
        $(el).addClass("status-error");
    }

    /**
     * Resolves the given address
     * @param {Object} addressEl
     */
    function resolveAddress ( els ) {
        var lock = $.Deferred();
        
        if ( els.length ) {
            var el = els[0];
            var address = $("input", el).val(); // text field containing the address
            
            if ( address ) {
                // Text found. Resolve the address.
                geocoder.geocode ( {"address": address}, function(results, status) {
                    if ( results.length === 1 ) {
                        clearError(el);

                        var result = results[0];
                        var location = result.geometry.location;
                        
                        // single valid address - expected case
                        $(el).data({"location": location});
                        $("span.resolution", el).html(result.formatted_address);
                        $("span.lat-long", el).html(location.toString());
                        
                    } else if ( results.length ) {
                        // multiple possible addresses.
                        displayError ( el, "This address matches multiple locations. Please be more specific.");
                        $("span.resolution", el).html("");
                        $("span.lat-long", el).html("");
                        
                    } else {
                        // no valid results found.
                        displayError ( el, "Unable to find lat/long coordinates for this address. Please reenter.");
                        $("span.resolution", el).html("");
                        $("span.lat-long", el).html("");
                    }
                    
                    lock.resolve();
                });
            } else {
                // Simply resolve the lock - no resolution to be done.
                lock.resolve();
            }
        }
        
        return lock.promise();
    }
    
    function getDestination() {
        var requestedDestination = $("div.address.destination").data();

        return requestedDestination.location;
    }

    function getOrigin() {
	    var result;

        // Use the entered address, if available.
        var requestedOrigin = $("div.address.origin").data();
	    if ( requestedOrigin.location ) {
            result = requestedOrigin.location;

        } else if ( navigator && navigator.geolocation && navigator.geolocation.coords ) {
            alert ( "Using browser-geolocated coordinates" );
            var coords = navigator.geolocation.coords;
            result = new google.maps.LatLng ( coords.latitude, coords.longitude );
        }

        return result;
    }

    function updateMap ( origin, destination ) {
        var directionsService = new google.maps.DirectionsService();
        var request = {
            "origin": origin,
            "destination": destination,
            "travelMode": google.maps.TravelMode.BICYCLING
        };

        directionsService.route ( request, function ( result, status ) {
            // Keep a module-private variable to the renderer so that
            //  future updates
            if (!renderer) {
                renderer = new google.maps.DirectionsRenderer();
                renderer.setMap(map);
            }
            
            renderer.setDirections(result);
        });
    }

    function initmap () {
        var myOptions = {
            "zoom": 13,
            "center": seattle,
            "mapTypeId": google.maps.MapTypeId.ROADMAP
        };
        var mapCanvas = $("#map_canvas")[0];
    
        map = new google.maps.Map(mapCanvas, myOptions);

        var bikeLayer = new google.maps.BicyclingLayer();
        bikeLayer.setMap(map);
    }
    
    $_.update = function() {
        // If this is the first time the 'map' button has been clicked,
        //  initialize the map first.
        if ( !map ) {
            initmap();
        }
        
        $.when(
                resolveAddress ( $("div.address.origin") ),
                resolveAddress ( $("div.address.destination") )
        ).then ( function() {
            var origin = getOrigin();
            var destination = getDestination();
            
            if ( origin && destination ) {
                updateMap ( origin, destination );
            }
        });
    }
    
    // Set up event handlers
    $("input#update").click($_.update);
})();
