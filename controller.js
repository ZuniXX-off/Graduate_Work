const controller = {
  init() {
    model.init(this.createCustomSearchProvider);
  },

  addPlacemarkToRoute(fullInfo) {
    /*Изменяет текст кнопки, расположенной
    * во всплывающем окне*/
    view.changeButtonText('select-placemark', 'Удалить из маршрута');
    /*Получение метки с карты
    * (объект Placemark), которая
    * была добавлена в маршрут*/
    const placemark = model.getPlacemark(fullInfo.id);
    // Изменение параметра selected
    placemark.properties.set('selected', true);
    // Изменнеие цвета метки
    controller.resetPlacemarkIcon(placemark)

    // Получение списка достопримечательностей в маршруте
    const routePoints = model.getRoutePoints();

    /*Если последняя точка зафиксирована,
    * то новая точка добавляется как предпоследняя
    * иначе - в конец*/
    if (model.getRouteParam('lastFixed')) {
      const lastPoint = routePoints.pop();
      routePoints.push(fullInfo);
      routePoints.push(lastPoint);
    }
    else {
      routePoints.push(fullInfo);
    }

    /*Применение внесенных изменений*/
    model.setRouteParams({
      points: routePoints,
    });
    /*Закрытие всплывающего окна*/
    placemark.balloon.close();
  },

  removePlacemarkFromRoute(id) {
    view.changeButtonText('select-placemark', 'Добавить в маршрут');
    view.unbindRouteEvent(id);
    const placemark = model.getPlacemark(id);
    placemark.properties.set('selected', false);
    controller.resetPlacemarkIcon(placemark);

    const routePoints = model.getRoutePoints();
    let name = model.getRouteParam('name');

    const index = routePoints.findIndex(item => item.id === id);
    const point = routePoints.splice(index, 1);

    URL.revokeObjectURL(point.photo);
    if (!routePoints.length) {
      name = null;
    }

    model.setRouteParams({
      points: routePoints,
      name: name,
    });
  },

  swapPlacemarksInRoute(id, move) {
    const routePoints = model.getRoutePoints();
    const index = routePoints.findIndex(item => item.id === id);

    const tmp = routePoints[index];
    routePoints[index] = routePoints[index + move];
    routePoints[index + move] = tmp;

    model.setRouteParams({
      points: routePoints,
    });
  },

  resetPlacemarkIcon(placemark) {
    let icon = '';

    if (placemark.properties.get('searched')) {
      icon = 'islands#yellowDotIcon';
    }
    else if (placemark.properties.get('selected')) {
      icon = 'islands#violetDotIcon';
    }
    else if (placemark.properties.get('working')) {
      icon = 'islands#greenDotIcon';
    }
    else {
      icon = 'islands#redDotIcon';
    }

    placemark.options.set('preset', icon);
  },

  buttonInPlacemark(fullInfo) {
    const selected = model.getPlacemark(fullInfo.id).properties.get('selected');
    if (selected) {
      controller.removePlacemarkFromRoute(fullInfo.id);
    }
    else {
      controller.addPlacemarkToRoute(fullInfo);
    }
  },

  removeRoute(name) {
    const currentName = model.getRouteParam('name');
    if (currentName === name) {
      model.setRouteParams({
        name: null,
      });
    }
    model.doRequestRemoveRoute({name: name}, true);
  },

  getSaveRoutes() {
    model.getSavedRoutes().then(routes => {
      view.createRoutesPage(routes);
      view.initRoutePageButtons(routes);
    });
  },

  routeToMap(route, button) {
    controller.deleteRoute();

    controller.setRouteParams({
      name: route.name,
      firstFixed: route.firstFixed,
      lastFixed: route.lastFixed,
      points: route.points,
      currentWay: route.way,
      currentButton: button,
      visible: true,
      unSaved: false,
    });

    route.points.forEach(item => {
      const placemark = model.getPlacemark(item.id);
      placemark.properties.set('selected', true);
      controller.resetPlacemarkIcon(placemark)
    });
  },

  openPlacemark(placemark) {
    const selected = placemark.properties.get('selected');
    const id = placemark.properties.get('id');

    if (selected) {
      const fullInfo = model.getRoutePoints().find(item =>
        item.id === id
      );
      placemark.options.set('balloonContentLayout', view.createPlacemarkHTMLTemplate(
        fullInfo, selected, controller.buttonInPlacemark
      ));
    }
    else {
      model.getFullAttraction(id).then((fullInfo) => {
        placemark.options.set('balloonContentLayout', view.createPlacemarkHTMLTemplate(
          fullInfo, selected, controller.buttonInPlacemark
        ));
        placemark.balloon.open();
      });
    }
  },

  closePlacemark(placemark) {
    placemark.options.unset('balloonContentLayout');
  },

  clearSearch() {
    const placemark = model.getPlacemarkByPropertyValue('searched', true);
    if (placemark) {
      placemark.properties.set('searched', false);
      controller.resetPlacemarkIcon(placemark)
      placemark.options.unset('balloonContentLayout');
      placemark.balloon.close();
    }
  },

  showSearch(id) {
    this.clearSearch();

    const placemark = model.getPlacemark(id);

    placemark.properties.set('searched', true);
    controller.resetPlacemarkIcon(placemark)
    this.openPlacemark(placemark);

    const map = model.getMap();
    map.setCenter(placemark.geometry.getCoordinates(), 18).then(() => {
      placemark.balloon.open();
    });


  },

  createCustomSearchProvider(points) {
    let customSearchProvider = function (points) {
      this.points = points;
    }

    customSearchProvider.prototype.findObjects = function (array, target) {
      return array.filter((item) => {
        return (item.name.toLowerCase().indexOf(target.toLowerCase()) !== -1
          || item.class.toLowerCase().indexOf(target.toLowerCase()) !== -1
        );
      });
    }

    customSearchProvider.prototype.suggest = function (request, options) {
      const points = this.findObjects(this.points, request);
      let result = [];

      points.forEach((item) => {
        result.push({displayName: item.name, value: item.name });
      });

      return ymaps.vow.resolve(result);
    }

    customSearchProvider.prototype.geocode = function (request, options) {
      let deferred = new ymaps.vow.Deferred();
      let geoObjects = new ymaps.GeoObjectCollection();
      const offset = options.skip || 0;
      const limit = options.result || 20;

      let points = this.findObjects(this.points, request);

      points = points.splice(offset, limit);

      points.forEach((item) => {
        let mark = new ymaps.Placemark(
          item.coords, {
            id: item.id,
            hintContent: item.name,
            name: item.name,
            selected: false,
            searched: false,
          }
        );
        geoObjects.add(mark);
      });

      deferred.resolve({
        geoObjects: geoObjects,
        metaData: {
          geocoder: {
            request: request,
            found: geoObjects.getLength(),
            results: limit,
            skip: offset,
          }
        }
      });

      return deferred.promise();
    }

    return new customSearchProvider(points);
  },

  updateRoute() {
    // Получение текущего маршрута на карте
    let route = model.getRouteOnMap();

    if (route) {
      // Удаление маршрута с карты
      route.setParent(null);
    }
    // Если маршрут можно выводить
    if (model.getRouteParam('visible') && model.getRouteLength() > 1) {
      let points = [];
      /*Для каждой добавленной в маршрут точки
      * в список добавляются координаты*/
      model.getRoutePoints().forEach(item => {
        points.push([item['coord_longitude'], item['coord_latitude']]);
      });
      // Создается новый маршрут
      let newRoute = new ymaps.multiRouter.MultiRoute({
        referencePoints: points, // Список координат
        params: {
          // Тип маршрута
          routingMode: model.getRouteParam('currentWay'),
          // Количество варинтов маршрута
          results: 1,
        }
      }, {
        // Удаление с карты лишних объектов
        wayPointVisible: false,
        routeWalkMarkerVisible: false,
      });
      // Добавление нового маршрута на карту
      model.setRouteOnMap(newRoute);
    }
  },

  changeRouteWay(button) {
    const way = button.data.get('way');
    model.setRouteCurrentButton(button);
    model.setRouteCurrentWay(way);
    const route = model.getRouteOnMap();
    if (model.getRouteLength() > 1) {
      route.setParent(null);

      let points = [];
      model.getRoutePoints().forEach(item => {
        points.push([item['coord_longitude'], item['coord_latitude']]);
      });

      let newRoute = new ymaps.multiRouter.MultiRoute({
        referencePoints: points,
        params: {
          routingMode: way,
          results: 1,
        }
      }, {
        wayPointVisible: false,
        routeWalkMarkerVisible: false,
      });

      model.setRouteOnMap(newRoute);
    }
  },

  deleteRoute() {
    // Получение списка добавленных точек
    const points = model.getRoutePoints()
    /*Для каждой точки
    * находится соответствующая метка
    * на карте, изменяется ее цвет
    * и удаляется локальная ссылка на фотографию
    * */
    points.forEach(item => {
      const placemark = model.getPlacemark(item.id);
      placemark.properties.set('selected', false);
      controller.resetPlacemarkIcon(placemark)
      URL.revokeObjectURL(item.photo);
    });
    /*Производится полная очистка текущего маршрута
    * все важные значения устанавливаются "по умолчанию"*/
    model.setRouteParams({
      points: [],
      visible: true,
      firstFixed: false,
      lastFixed: false,
      name: null,
      unSaved: false,
    });
  },

  setRouteParams(params) {
    model.setRouteParams(params);
  },

  registration(login, email, password) {
    model.registration(login, email, password);
  },

  login(login, password) {
    model.login(login, password);
  },

  quit() {
    model.quit();
  },

  createRequestRouteObject(name) {
    const points = [];
    model.getRoutePoints().forEach(item => {
      points.push(item.id);
    });
    return {
      name: name,
      points: points,
      firstFixed: model.getRouteParam('firstFixed'),
      lastFixed: model.getRouteParam('lastFixed'),
      way: model.getRouteParam('currentWay'),
    };
  },

  saveRoute(name) {
    model.setRequestSaveRoute(this.createRequestRouteObject(name), true).then(ans => {
      model.setRouteParams({
        unSaved: false,
        name: name,
      });
    });
  },

  optimizeRoute() {
    controller.createTimeMatrixJson().then((timeMatrix) => {
      model.getRequestOptimizedRoute(timeMatrix).then(json => {
        model.setRouteParams({points: controller.sortRouteByID(json)});
      })
    });
  },

  sortRouteByID(listID) {
    const points = model.getRoutePoints();
    const newOrder = [];

    listID.forEach(id => {
      newOrder.push(points.find(point => point.id === id));
    });

    return newOrder;
  },

  async createTimeMatrixJson() {
    const json = {
      id: [],
      paths: [],
      fixFirst: model.getRouteParam('firstFixed'),
      fixLast: model.getRouteParam('lastFixed'),
    };

    const route = model.getRouteOnMap();

    const points = model.getRoutePoints();

    for (let i = 0, l = points.length; i < l; i++) {
      const routes = [];
      for (let j = 0; j < l; j++) {
        if (i !== j) {
          let duration = 0;

          route.model.setReferencePoints([
            [points[i]['coord_longitude'], points[i]['coord_latitude']],
            [points[j]['coord_longitude'], points[j]['coord_latitude']]
          ]);

          duration = route.model.getRoutes()[0].properties.get('duration').value;

          routes.push(duration);

          await delay(300);
        }
      }
      json.id.push(points[i].id);
      json.paths.push(routes);
    }

    const oldPoints = [];

    points.forEach(item => {
      oldPoints.push([item['coord_longitude'], item['coord_latitude']]);
    });
    route.model.setReferencePoints(oldPoints);

    return json;
  }
}
