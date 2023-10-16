const model = {

  /*
  * Инициализиация объекта, запускается 1 раз
  * */
  init(customSearchProvider) {
    /*Инициалзиация карты
    * Одним из параметров является id элемента
    * dom-дерева, куда она будет добавлена*/
    this._map = new ymaps.Map('map', {
      center:[59.93, 30.31], /*Координаты центра карты (По умолчанию Санкт-Петебург)*/
      zoom:10, /*Масштаб карты*/
      controls: ['zoomControl'], /*Перечень элементов управления (по умолчанию доступен слайдер для изменения масштаба)*/
    }, {
      minZoom: 11, /*Минимальный масштаб*/
    });
    /*Инициализация кластеризатора, в который будут помещены метки достопримечательностей*/
    this._clusterer = new ymaps.Clusterer({
      hasHint: false, /*При наведении на кластер не будет появляться всплывающая подсказка*/
      minClusterSize: 3, /*Минимальное количество объектов для кластеризации*/
      preset: 'islands#invertedBlackClusterIcons', /*Установка стиля метки кластера*/
    });

    /*Обработка объекта Promise, полученного после вызова метода getRequestLiteAttractions
    * Promise -- объект-обещание того, что асинхронный код, пораждающий его, будет когда-нибудь выполнен
    * Для того, чтобы обработать полученные асинхронно данные, необходимо
    * использовать метод then, в который помещается функция-callback*/
    this.getRequestLiteAttractions().then(json => {
      /*Для каждого объекта в списке json создается метка Placemark и
      * помещается в созданный ранее кластер*/
      json.forEach((item) => {
        this._clusterer.add(this.createPlacemark(item));
      });
      // Изменнеие границ карты в соответствии с нанесенными на карту точками
      this._map.setBounds(this._clusterer.getBounds(), {checkZoomRange: true});
      // Инициализация обработчиков событий обработки меток (выполняется в модуле View)
      view.initPlacemarkEvents();
      /* Создание поисковой строки по собственным точкам
      *  getRequestLiteAttractions является функцией-конструктором,
      *  переданным при инициализации из модуля Controller*/
      const searchControl = new ymaps.control.SearchControl({
        options: {
          provider: customSearchProvider(json),
          noPlacemark: true, /*не наносит на карту дополнительные метки*/
          resultPerPage: 5, /*количество результатов поиска во всплывающем ниже окне*/
          noCentering: true, /*не изменяет положение карты при успешном нахождении точки*/
        }
      });
      // Инициализация обработчиков событий для поисковой строки
      view.initSearchControlEvents(searchControl);
      // Добавление поисковой строки на карту
      this._map.controls.add(searchControl, {float: 'right'});
    });
    /*Добавление кластеризатора на карту*/
    this._map.geoObjects.add(this._clusterer);
    /*Вспомогательные массивы для инициализации кнопок управления типом маршрута*/
    const ways = ['masstransit', 'pedestrian', 'auto', 'bicycle'];
    const titles = ['Общественный транспорт', 'Пеший', 'Автомобильный', 'Велосипедный']
    /*Инициализация объекта, описывающего текщий маршрут пользователя*/
    this._route = {
      points: [], /*Список достопримечательностей (сохраняется полное описание для оптимизации запросов к серверу)*/
      routeOnMap: null, /*Объект класса MultiRoute, выводимый на карту (по умолчанию объект не инициализирован)*/
      firstFixed: false, /*Флаг фиксации первой точки маршрута (запрет на перемещение)*/
      lastFixed: false, /*Флаг фиксации последней точки маршрута*/
      visible: true, /*флаг отображения маршрута на карте (удаляет MultiRoute с карты)*/
      currentWay: 'masstransit', /*Тип маршрута*/
      currentButton: null, /*Объект типа Button, отвечающий за текущий тип маршрут*/
      unSaved: true, /*Флаг необходимости сохранения внесенных изменений*/
      name: null, /*Имя маршрута (можно задавать только после авторизации)*/
      maxPoints: 10, /*Константа максимального количества точек в маршруте (можно добавлять больше, но проподает
                     * возможность сохранять маршрут)*/
    };
    /*Инициализация объекта, описывающего пользователя*/
    this._user = {
      login: null, /*Логин пользователя, указанный при регистрации*/
      accessToken: null, /*Токен доступа пользователя (многоразовая краткоживащая строка, уникально идентифицирующая
                         * пользователя и дающая доступ к функционалу, требующему авторизации)*/
    };
    /*Список объектов Button, отвечающих за выбор типа маршрута*/
    this._buttons = [];
    /*Инициализация объектов Button*/
    ways.forEach((item, index) => {
      const button = new ymaps.control.Button({
        data: {
          image: 'img/UI/' + item + '.png', /*Изображение на кнопке*/
          title: titles[index] + ' маршрут', /*Текст всплывающей подсказки*/
          way: item /*Тип маршрута, за который отвечает кнопка*/
        },
        options: {
          selectOnClick: index !== 0, /*По умолчанию кнопку можно нажать, если это не masstransit маршрут*/
        },
        state: {
          selected: index === 0, /*По умолчанию кнопка выделена, если это masstransit маршрут*/
        }
      });
      /*Если кнопка отвечает за masstransit маршрут, то добавляется в маршрут*/
      if (index === 0) this._route.currentButton = button;
      /*Инициализация логики поведения при нажатии на кнопку*/
      view.initMapControlButton(button);
      /*Добавление кнопок на карту и в список*/
      this._map.controls.add(button);
      this._buttons.push(button);
    });
    /*Инициалзация всех элементов управления текущим маршрутом*/
    view.initRouteControls();
    /*Инициализация всех элментов управления в профиле пользователя*/
    view.initProfileButtons();
    /*Попытка авторизации пользователя (выполняется если пользовтель уже был авторизован на сайте ранее
    * и тоекн обновления, хранимый в cookie действителен)*/
    this.getRequestTokenPair().then(ans => {
      if (ans) {
        /*Изменение формы пользователя*/
        view.loggedInOut();
      }
    });
  },

  /*
  * Асинхронный метод получения списка основной информации о всех известных достопримечательностей
  * Возвращает список объектов если запрос выполнен, иначе -- пустой список (объект имеет структуру:
  *
  * id -- уникальный идентификатор достопримечательности (целое число)
  *
  * name -- название достопримечательности (строка)
  *
  * class -- тип достопримечательности (музей, парк и т.д.) (строка)
  *
  * coord_longitude -- долгота (число с плавающей точкой)
  *
  * coord_latitude -- широта (число с плавающей точкой)
  *
  * working -- можно ли посетить достопримечательность на момент выполнения запроса (принимает значения 1 или 0))*/
  async getRequestLiteAttractions() {
    /*Запрос на сервер (по умолчанию тип запроса GET)
    * Ключевое слово await приостанавливает выполнение кода, пока запрос не будет выполнен*/
    let response = await fetch('http://26.228.215.194:3000/api/lite_attractions_list');
    if (response.ok) {
      return (await response.json()).attractions;
    }
    else {
      console.log('HTTP Error: ' + response.status);
      return [];
    }
  },

  /*
  * Асинхронный метод получения полной информации о конкретной достопримечательности
  *
  * Параметры:
  *
  * - id -- уникальный идентификатор достопримечательности (целое число)
  *
  * Возвращает объект если запрос выполнен, иначе -- null (объект имеет структуру:
  *
  * id -- уникальный идентификатор достопримечательности (целое число)
  *
  * name -- название достопримечательности (строка)
  *
  * class -- тип достопримечательности (музей, парк и т.д.) (строка)
  *
  * description -- описание достопримечательности (строка)
  *
  * coord_longitude -- долгота (число с плавающей точкой)
  *
  * coord_latitude -- широта (число с плавающей точкой)
  *
  * rating -- рейтинг достопримечательности, полученный из открытых источников и основанный на отзывах посетителей
  * (число с плавающей точкой в диапозоне от 0 до 5)
  *
  * cost -- стоимость посещения достопримечательности (если такой информации нет, то 0) (целое число))
  * */
  async getRequestFullAttraction(id) {
    let response = await fetch(
      'http://26.228.215.194:3000/api/full_attraction_info_with_schedule', {
        method: 'POST', /*Тип запроса*/
        body: JSON.stringify({'id': id}), /*Содержимое запроса*/
        headers: {
          'Content-Type': 'application/json;charset=utf-8', /*Тип отправляемых на сервер данных*/
        }
      });
    if (response.ok) {
      return await response.json();
    }
    else {
      console.log('HTTP Error: ' + response.status);
      return null;
    }
  },

  /*
  * Асинхронный метод получения изображения конкретной достопримечетальности
  *
  * Параметры:
  *
  * - id -- уникальный идентификатор достопримечательности (целое число)
  *
  * Возвращает ссылку на изображение если запрос выполнен, иначе -- null
  *
  * */
  async getRequestAttractionPicture(id) {
    let response = await fetch('http://26.228.215.194:3000/api/picture_by_id', {
      method: 'POST',
      body: JSON.stringify({'id': id}),
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
      }
    });

    if (response.ok) {
      return URL.createObjectURL(await response.blob());
    }
    else {
      console.log('HTTP Error: ' + response.status);
      return null;
    }
  },
  /*Асинхронный метод получения оптимизированного маршрута
  *
  * Параметры:
  *
  * - json -- объект, содержащий в себе матрицу расстояний и параметры маршрута
  *
  * Возвращает новый оптимизированный список достопримечательностей*/
  async getRequestOptimizedRoute(json) {
    let response = await fetch('', {
      method: 'POST',
      body: JSON.stringify(json),
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
      }
    });
    if (response.ok) {
      return await response.json();
    }
    else {
      console.log('HTTP Error: ' + response.status);
      return [];
    }
  },
  /*Асинхронный метод получения полного объекта, описывающего достопримечательность
  *
  * Параметры:
  *
  * - id -- уникальный идентификатор достопримечательности*/
  async getFullAttraction(id) {
    let fullInfo = await model.getRequestFullAttraction(id);
    fullInfo.photo = await model.getRequestAttractionPicture(id);

    return fullInfo;
  },
  /*Асинхронный запрос выполнения авторизации пользователя
  *
  * Параметры:
  *
  * - login -- логин пользователя
  *
  * - password -- пароль пользователя*/
  async doRequestLogin(login, password) {
    const response = await fetch('http://26.228.215.194:3000/auth/login', {
      method: 'POST',
      body: JSON.stringify({'login': login, 'password': password}),
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
      },
      credentials: "include", /*Разрешение на использование и получение cookie-файлов от кросс-доменных запросов*/
    });
    if (response.ok) {
      const json = await response.json();
      this._user.accessToken = json['access']; /*Сохранение токена доступа*/
      return true;
    }
    else {
      console.log('HTTP Error: ' + response.status);
      return false;
    }
  },
  /*Асинхронный запрос выполнения регистрации пользователя
  *
  * Параметры:
  *
  * - login -- логин пользователя
  *
  * - password -- пароль пользователя
  *
  * - email -- почта пользователя*/
  async doRequestRegistration(login, password, email) {
    const response = await fetch('http://26.228.215.194:3000/auth/registration', {
      method: 'POST',
      body: JSON.stringify({'login': login, 'password': password, 'email': email}),
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
      },
      credentials: "include",
    });

    if (response.ok) {
      const json = await response.json();
      this._user.accessToken = json['access'];
      return true;
    }
    else {
      console.log('HTTP Error: ' + response.status);
      return false;
    }
  },
  /*Асинхронный метод выполнения выхода из аккаунта пользователя*/
  async doRequestLogout() {
    const response = await fetch('http://26.228.215.194:3000/auth/logout', {
      credentials: "include",
    });

    if (response.ok) {
      const json = await response.json();
      this._user.accessToken = null;
      return json.successful;
    }
    else {
      console.log('HTTP Error: ' + response.status);
      return false;
    }
  },
  /*Асинхронный метод обновления пары токенов*/
  async getRequestTokenPair() {
    const response = await fetch('http://26.228.215.194:3000/auth/refresh', {
      method: 'GET',
      credentials: "include",

    });

    if (response.ok) {
      const json = await response.json();
      this._user.accessToken = json['access'];
      this._user.login = json.user.login;
      return true;
    }
    else {
      console.log('HTTP Error: ' + response.status);
      return false;
    }
  },
  /*Асинхронной метод получения списка сохраненных пользоваетелем маршрутов
  *
  * Параметры:
  *
  * - retry -- флаг выполнения повторного запроса в случае ошибки 401 (неавторизован)*/
  async getRequestUserRoutes(retry) {
    const response = await fetch('http://26.228.215.194:3000/api/user_routes_full', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this._user.accessToken}`, /*Передача серверу токена доступа пользователя (если его
                                                           * нет или устарел, то в доступе будет отказано)*/
      }
    });
    if (response.ok) {
      const json = await response.json();
      return json.savedRoutes;
    }
    /*Обработка случая ошибки 401 (пользователь неавторизован)*/
    else if (response.status === 401 && retry) {
      await this.getRequestTokenPair(); /*Поптыка получения новой пары токенов*/
      return (await this.getRequestUserRoutes(false)).savedRoutes; /*Повторный запрос, вызвавший ошибку*/
    }
    else {
      console.log('HTTP Error: ' + response.status);
    }
  },
  /*Асинхронный метод сохранения маршрута в профиль пользователя
  *
  * Параметры:
  *
  * - json -- объект, описывающий маршрут
  *
  * - retry -- флаг выполнения повторного запроса в случае ошибки 401 (неавторизован)*/
  async setRequestSaveRoute(json, retry) {
    const response = await fetch('http://26.228.215.194:3000/api/save_route', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this._user.accessToken}`,
        'Content-Type': 'application/json;charset=utf-8',
      },
      body: JSON.stringify(json),
    });
    if (response.ok) {
      return await response.json();
    }
    else if (response.status === 401 && retry) {
      await this.getRequestTokenPair();
      return await (await this.getRequestUserRoutes(false)).json();
    }
    else {
      console.log('HTTP Error: ' + response.status);
    }
  },
  /*Асинхронный метод сохранения маршрута в профиль пользователя
  *
  * Параметры:
  *
  * - json -- объект, хранящий имя удаляемого маршрута
  *
  * - retry -- флаг выполнения повторного запроса в случае ошибки 401 (неавторизован)*/
  async doRequestRemoveRoute(json, retry) {
    const response = await fetch('http://26.228.215.194:3000/api/remove_route', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this._user.accessToken}`,
        'Content-Type': 'application/json;charset=utf-8',
      },
      body: JSON.stringify(json),
    });
    if (response.ok) {
      return await response.json();
    }
    else if (response.status === 401 && retry) {
      await this.getRequestTokenPair();
      return await this.getRequestUserRoutes(false).json();
    }
    else {
      console.log('HTTP Error: ' + response.status);
    }
  },

  /*
  * Создает метку для отображения достопримечательности на карте
  *
  * Параметры:
  *
  * - info -- объект, описывающий основную информацию о достопримечательности (необходимые поля объекта info:
  *
  * id -- уникальный идентификатор достопримечательности (целое число)
  *
  * name -- название достопримечательности (строка)
  *
  * Возвращает объект класса Placemark из API Яндекс Карт
  * */
  createPlacemark(info) {
    return new ymaps.Placemark(
      /*Координаты метки*/
      [info['coord_longitude'], info['coord_latitude']], {
        id: info.id, /*id достопримечательности*/
        hintContent: info.name, /*Содержимое всплывающего окна*/
        selected: false, /*Флаг, отражающий была ли метка добавлена в маршрут*/
        searched: false, /*Флаг, отражающий была ли метка найдена через поиск*/
        working: info.working, /*Флаг работы метки на момент запроса*/
      }, {
        balloonPanelMaxMapArea: 0, /*Отключение режима боковой панели*/
        preset: info.working ?
          "islands#greenDotIcon" : "islands#redDotIcon", /*Цвет метки в зависимости от того,
                                                         * работает ли достопримечательность*/
      });
  },
  /*
  * Возвращает отображаемую на сайте карту с достопримечательностями (объект класса Map из API Яндекс Карт)
  * */
  getMap() {
    return this._map;
  },
  /*Асинхронный метод получения подробной информации о каждой достопримечательности в сохраненных маршрутах*/
  async getSavedRoutes() {
    const routes = await this.getRequestUserRoutes(true); /*Получение списка сохраненных маршрутов*/
    const res = [];
    for (let i = 0, l = routes.length; i < l; i++) {
      const points = [];
      const route = routes[i];
      for (let j = 0, k = route.points.length; j < k; j++) {
        points.push(await model.getFullAttraction(route.points[j])); /*Получение и сохранение подробной информации
                                                                     * о достопримечательности*/
      }
      route.points = points;
      res.push(route);
    }

    return res;
  },

  /*
  * Возвращает метку заданной достопримечательности по id (объект класса Placemark из API Яндекс Карт)
  *
  * Параметры:
  *
  * - id -- уникальный идентификатор достопримечательности (целое число)
  * */
  getPlacemark(id) {
    return this._clusterer.getGeoObjects().find(item => item.properties.get('id') === id);
  },

  /*
  * Возвращает метку заданной достопримечательности по значению поля объекта
  * (объект класса Placemark из API Яндекс Карт)
  *
  * Параметры:
  *
  * - property -- поле метки
  *
  * - value -- значение поля property
  * */
  getPlacemarkByPropertyValue(property, value) {
    return this._clusterer.getGeoObjects().find(item => item.properties.get(property) === value);
  },

  /*
  * Возвращает список меток всех достопримечательностей на карте
  * (список объектов класса Placemark из API Яндекс Карт)
  * */
  getListOfObjects() {
    return this._clusterer.getGeoObjects();
  },

  /*
  * Возвращает количество достопримечательностей, добавленных в маршрут (целое число)
  * */
  getRouteLength() {
    return this._route.points.length;
  },

  /*
  * Возвращает список достопримечательностей, добавленных в маршрут (список объектов, описывающих полную информацию
  * о достопримечательности)
  * */
  getRoutePoints() {
    return [...this._route.points];
  },

  /*
  * Возвращает маршрут, добавленный на карту (объект класса MultiRoute из API Яндекс Карт)
  * */
  getRouteOnMap() {
    return this._route.routeOnMap;
  },

  /*
  * Добавляет маршрут на карту (объект класса MultiRoute из API Яндекс Карт, сохраненный в model)
  * */
  setRouteOnMap(route) {
    this._route.routeOnMap = route
    if (route) {
      view.initRouteEvents();
      this._map.geoObjects.add(route);
    }

  },

  /*
  * Возвращает активную кнопку выбора типа маршрута (объект класса Button из API Яндекс Карт)
  * */
  getRouteCurrentButton() {
    return this._route.currentButton;
  },

  /*
  * Устанавливает новую активную кнопку выбора типа маршрута
  *
  * Параметры:
  *
  * - button -- новая активная кнопка выбора маршрута (объект класса Button из API Яндекс Карт)
  * */
  setRouteCurrentButton(button) {
    this._route.currentButton = button;
  },

  /*
  * Возвращает текущий тип маршрута (строка, принимающая следующие значения:
  *
  * "masstransit" -- общественный транспорт
  *
  * "auto" -- автомобильный
  *
  * "bicycle" -- велосипедный
  *
  * "pedestrian" -- пешеходный)
  * */
  getRouteCurrentWay() {
    return this._route.currentWay;
  },

  /*
  * Устанавливает новый тип маршрута
  *
  * Параметры:
  *
  * - way -- новый тип маршрута (строка, принимающая следующие значения:
  * "masstransit" -- общественный транспорт,
  * "auto" -- автомобильный,
  * "bicycle" -- велосипедный,
  * "pedestrian" -- пешеходный)
  * */
  setRouteCurrentWay(way) {
    this._route.currentWay = way;
  },

  /*
  * Устанавливает указанное поле объекта route (маршрута) в заданное значение и вызывает метод отрисвоки маршрута
  * у объекта view
  *
  * Параметры:
  *
  * - param -- поле объекта route (строка)
  *
  * - value -- значение поля param (любое значение)
  *
  * - reload -- перезагрузка отображаемого маршрута (true или false)
  * */
  setRouteParams(params) {
    const unSavedPrev = this._route.unSaved; /*Сохранение предыдущего состояния сохранения*/
    let changed = false; /*Флаг изменения относительно предыдущего состояния*/
    /*Флаг отражающий, были ли вносимые изменения существенный для маршрута*/
    const onlyVisible = params.visible !== undefined && Object.keys(params).length === 1;
    for (let key in params) {
      /*Если значение изменилось*/
      if (this._route[key] !== params[key]) {
        this._route[key] = params[key];
        changed = true;
        this._route.unSaved = true;
      }
    }
    /*Если изменился только флаг отображения на карте*/
    if (onlyVisible) this._route.unSaved = unSavedPrev;
    /*Если параметр состояния сохраненности был передан, то он считается приоритетным*/
    if (params.unSaved !== undefined) this._route.unSaved = params.unSaved;
    if (changed) {
      /*Если были изменения в маршруте, то изменяется его отображение*/
      view.loadRoute();
    }
  },

  /*
  * Получить значение поля объекта route
  *
  * Параметры:
  *
  * - param -- поле объекта route
  * */
  getRouteParam(param) {
    return this._route[param];
  },

  /*
  * Метод, выполняющий регистрацию пользователя
  *
  * Параметры:
  *
  * - login -- логин пользователя
  *
  * - email -- почта пользователя
  *
  * - password -- пароль пользователя
  * */
  registration(login, email, password) {
    this.doRequestRegistration(login, password, email).then(ans => {
      if (ans) {
        this._user.login = login;
        alert('Проверьте почту, Вам должно было прийти письмо');
        view.loggedInOut();
      }
    });
  },

  /*
  * Метод, выполняющий авторизацию пользователя
  *
  * Параметры:
  *
  * - login -- логин пользователя
  *
  * - password -- пароль пользователя
  * */
  login(login, password) {
    this.doRequestLogin(login, password).then(ans => {
      if (ans) {
        this._user.login = login;
        view.loggedInOut();
      }
    });
  },

  /*
  * Метод, выполняющий выход из аккаунта пользователя
  * */
  quit() {
    this.doRequestLogout().then(ans => {
      if (ans) {
        this._user.login = null;
        view.loggedInOut();
      }
    });
  },

  /*
  * Метод получения логина пользователя
  * */
  getLogin() {
    return this._user.login;
  },
  /*Метод получения кнопки, соответствующей заданному типу маршрута
  *
  * Параметры:
  *
  * - way -- тип маршрута*/
  getButton(way) {
    return this._buttons.find(item => item.data.get('way') === way);
  },
}
