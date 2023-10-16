function init () {
    controller.init();
}

const delay = ms => new Promise(resolve => {setTimeout(resolve, ms)});

ymaps.ready(init);
