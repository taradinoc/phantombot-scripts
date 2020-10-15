$(function() {
    var webSocket = new ReconnectingWebSocket((getProtocol() === 'https://' || window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host + '/ws/panel', null, { reconnectInterval: 500 }),
        localConfigs = getQueryMap();

    var snapToUpdate = false;

    // var counters = [
    //     { name: 'wins', title: 'Battles won', value: 10 },
    //     { name: 'attempts', title: 'Battles attempted', value: 30 },
    //     { name: 'nosound', title: 'No game audio', value: 5 },
    //     { name: 'muted', title: 'No mic audio', value: 13 },
    //     { name: 'cat', title: 'Doors opened for cats', value: 7 },
    //     { name: 'scrolled', title: 'Scrolled past the name', value: 2 },
    // ];

    // function initItems() {
    //     $.get('/addons/multicounter/ALL.json', { webauth: getAuth() }, function(data) {
    //         $('#slider').append(
    //             $.map(data, function(v, k) {
    //                 return makeSlide(k, v.title, v.value);
    //             })
    //         );
    //     });
    // }

    function makeSlide(name, title, value) {
        return $('<div></div>')
            .data('counterName', name)
            .append(
                $('<span></span>').addClass('counter-title').text(title),
                document.createTextNode(': '),
                $('<span></span>').addClass('counter-value').text(value));
    }

    function $namedSlides(name) {
        return $('#slider .slick-slide')
            .filter(function () { return $(this).data('counterName') === name; });
    }

    function handleCounterUpdate(name, data) {
        log('set ' + name + ' to ' + JSON.stringify(data));

        let updatedSlides = $namedSlides(name);

        if (!updatedSlides.length) {
            let newSlide = makeSlide(name, data.title || name, data.value);
            $('#slider').slick('slickAdd', newSlide);
            updatedSlides = $namedSlides(name);
        }

        // update value
        if (data.value !== undefined) {
            updatedSlides.children('.counter-value')
                .addClass('updated-hot')
                .text(data.value);
        }

        // if (data.title !== undefined) {
        //     updatedSlides.children('.counter-title')
        //         .addClass('updated-hot')
        //         .text(data.title);
        // }

        // call attention to it
        //updatedSlides.effect({ effect: 'highlight', duration: 1500, queue: false, color: '#669966' });
        updatedSlides
            .addClass('updated')
            .one('animationend',
                function (e) {
                    //console.log($(this).text() + '; ' + e.originalEvent.animationName + '; ' + newClass);
                    $(this)
                        .removeClass('updated')
                        .children('.updated-hot').removeClass('updated-hot');
                });

        // scroll it into view
        if (isScrolling()) {
            $('#slider')
                .slick('slickGoTo', /* idx */ updatedSlides.last().data('slickIndex'), snapToUpdate);
        }

        //setTimeout(bumpOne, Math.floor(5000 + Math.random() * 5000));
    }

    /**
     * Gets a map of the URL query
     * @function getQueryMap
     * @returns {Map<string, string>}
     */
    function getQueryMap() {
        let queryString = window.location.search, // Query string that starts with ?
            queryParts = queryString.substr(1).split('&'), // Split at each &, which is a new query.
            queryMap = new Map(); // Create a new map for save our keys and values.

        for (let i = 0; i < queryParts.length; i++) {
            let key = queryParts[i].substr(0, queryParts[i].indexOf('=')),
                value = queryParts[i].substr(queryParts[i].indexOf('=') + 1, queryParts[i].length);

            if (key.length > 0 && value.length > 0) {
                queryMap.set(key.toLowerCase(), value);
            }
        }

        return queryMap;
    }

    /**
     * Used to send messages to the socket. This should be private to this script.
     * @function sendToSocket
     * @param {object} message
     */
    function sendToSocket(message) {
        try {
            let json = JSON.stringify(message);

            webSocket.send(json);

            // Make sure to not show the user's token.
            if (json.indexOf('authenticate') !== -1) {
                logSuccess('sendToSocket:: ' + json.substring(0, json.length - 20) + '.."}');
            } else {
                logSuccess('sendToSocket:: ' + json);
            }
        } catch (e) {
            logError('Failed to send message to socket: ' + e.message);
        }
    };

    /**
     * Checks if the query map has the option, if not, returns default.
     * @function getOptionSetting
     * @param  {String} option The option name to check.
     * @param  {String} def The default value to use if the option was not provided.
     * @return {String}
     */
    function getOptionSetting(option, def) {
        option = option.toLowerCase();

        if (localConfigs.has(option)) {
            return localConfigs.get(option);
        } else {
            return def;
        }
    };

    function isScrolling() {
        return getOptionSetting('scrolling', 'true') === 'true';
    }

    /**
     * Used to log things in the console.
     * @function logSuccess
     * @param {string} message
     */
    function logSuccess(message) {
        console.log('%c[PhantomBot Log]', 'color: #6441a5; font-weight: 900;', message);
    };

    /**
     * Used to log things in the console.
     * @function logError
     * @param {string} message
     */
    function logError(message) {
        console.log('%c[PhantomBot Error]', 'color: red; font-weight: 900;', message);
    };

    /**
     * @param {string} msg
     */
    function log(msg) {
        console.log(msg);
        //$('#log').empty();
        //$('#log').append($('<li></li>').text(msg));
    }

    $(document).ready(function () {
        // initItems();
        let scrolling = isScrolling();

        // slick carousel
        $('#slider').slick({
            arrows: false,
            vertical: true,
            draggable: false,
            /* fade: true, */
            slidesToShow: parseInt(getOptionSetting('show', '1')),
            infinite: scrolling,
            slidesToScroll: 1,
            autoplay: scrolling,
            autoplaySpeed: 3000,
            speed: 300,
            cssEase: 'linear',
            verticalSwiping: true,
            waitForAnimate: false
        });
    });

    // WebSocket events
    
    webSocket.onopen = function () {
        logSuccess('Connection established with the websocket.');

        // Auth with the socket.
        sendToSocket({
            authenticate: getAuth()
        });
    };

    /**
     * @function Socket calls when it closes
     */
    webSocket.onclose = function () {
        logError('Connection lost with the websocket.');
    };

    /**
     * @function Called when we get a message.
     *
     * @param {Object} e
     */
    webSocket.onmessage = function (e) {
        try {
            // Handle PING/PONG
            if (e.data == 'PING') {
                webSocket.send('PONG');
                return;
            }

            let rawMessage = e.data,
                message = JSON.parse(rawMessage);

            console.log('WS received', rawMessage);

            if (!message.hasOwnProperty('query_id')) {
                // Check for our auth result.
                if (message.hasOwnProperty('authresult')) {
                    if (message.authresult === 'true') {
                        logSuccess('Successfully authenticated with the socket.');

                        // request all counters
                        sendToSocket({
                            dbkeyslist: 'multicounter_init',
                            query: [{ table: 'multiCounterValues' }, { table: 'multiCounterTitles' }]
                        });
                    } else {
                        logError('Failed to authenticate with the socket.');
                    }
                } else if (message.hasOwnProperty('counter_update')) {
                    /** @type {Array<{name: string, title: string, value: number}>} */
                    let data = JSON.parse(message.data);
                    for (let u in data) {
                        let { name, title, value } = data[u];
                        let updatedSlides = $namedSlides(name);
                        let update = {};

                        if (title !== updatedSlides.children('.counter-title').text()) {
                            update.title = title;
                        }
                        let strValue = value + '';
                        if (strValue !== updatedSlides.children('.counter-value').text()) {
                            update.value = strValue;
                        }
                        handleCounterUpdate(name, update);
                    }
                } else {
                    logError(message);
                }
            } else {
                // it's a query response
                if (message.query_id === 'multicounter_init') {
                    let counters = {};
                    for (let row of message.results) {
                        let result = counters[row.key] || (counters[row.key] = {});
                        if (row.table === 'multiCounterValues') {
                            result.value = row.value;
                        } else if (row.table === 'multiCounterTitles') {
                            result.title = row.value;
                        }
                    }
                    console.log('got counters', counters);
                    let slider = $('#slider');
                    for (let key in counters) {
                        let slide = makeSlide(key, counters[key].title, counters[key].value);
                        slider.slick('slickAdd', slide);
                    }
                }
            }
        } catch (ex) {
            logError('Error while parsing socket message: ' + ex.message);
            logError('Message: ' + e.data);
        }
    };
});