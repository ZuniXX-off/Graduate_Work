const view = {
  /*Метод создания шаблона для всплывающего окна при нажатии на метку достопримечательности
  * Параметры:
  * - fullInfo -- подробная информация о достопримечательности
  * - selected -- флаг, означающий была ли метка добавлена в маршрут
  * - callback -- функция, которая будет вызвана при нажатии на кнопку
  * (задаеится в зависимости от того, была ли кнопка добавлена в маршрут*/
  createPlacemarkHTMLTemplate(fullInfo, selected, callback) {
    /*Создание класса, описывающего содержимое достопримечательность*/
    const balloonContentLayout = ymaps.templateLayoutFactory.createClass(
      /*Генерация содержимого всплывающего окна*/
      view.createPlacemarkHTMLContent(fullInfo, selected), {
        /*Функция будет автоматически вызвана при открытии всплывыающего окна*/
        build: function() {
          balloonContentLayout.superclass.build.call(this);
          /*Создание обработчки события нажатия на кнопку*/
          $('#select-placemark').bind('click', () => callback(fullInfo));
        },
        /*Функция будет автоматически вызвана при закрытии всплывающего окна*/
        clear: function() {
          /*Удаление обработчика события нажатия на кнопку*/
          $('#select-placemark').unbind('click');
          balloonContentLayout.superclass.clear.call(this);
        },
      });

    return balloonContentLayout;
  },
  /*Создает содержимое всплывающего окна при нажатии на метку
  * Содержимое имеет следующий вид:
  * - Название достопримечательности
  * - Тип достопримечательности
  * - Изображение
  * - Описание
  * - Рейтинг, взятый из открытых источников
  * - Цена посещения
  * - Расписание на неделю с указанием текущего дня
  * - Если закрыто, то указано когда откроется в следующий раз
  * Каждый пункт отдельно проверяется на случай, если нет информации
  * Параметры:
  * - fullInfo - подробная информация о достопримечательности
  * - selected - флаг, означающий, была ли добавлена достопримечательность в маршрут
  * Возвращает строку с html кодом*/
  createPlacemarkHTMLContent(fullInfo, selected) {
    let htmlContent = '';
    if (fullInfo) {
      htmlContent += `<div><b>${fullInfo.name}</b><br/>
        ${(fullInfo.class ? `<span>${fullInfo.class}</span><br/>` : '')}
        ${(fullInfo.photo ? `<img src=${fullInfo.photo} height="100" width="150" alt=""> <br/>` : '')}
        ${(fullInfo.description ? `<b>Описание</b> <br/>${fullInfo.description}<br/>` : '')}
        ${(fullInfo.rating ? `<b>Рейтинг: </b>${fullInfo.rating.toString()}<br/>` : '')}
        ${(fullInfo.cost ? `<b>Стоимость посещения: </b>${fullInfo.cost.toString()}₽<br/>` : '')}
        ${(fullInfo.schedule ? `<b>Расписание: </b><br/>${view.createPlacemarkSchedule(fullInfo)}` : '')}
        ${(fullInfo.working ? '' :
        `<b style="color: red">${view.createPlacemarkSchedule(fullInfo, true)}</b><br/>`)}
          <button id="select-placemark">${selected ? 'Удалить из маршрута'
        : 'Добавить в маршрут'}</button></div>`;
    }
    else {
      htmlContent = '<b style="color: red">Ошибка загрузки</b>';
    }
    return htmlContent;
  },
  /*Создание текста, содержашего расписание достопримечательности
  * Параметры:
  * - fullInfo -- подробная информация о достопримечательности
  * - todayOnly -- флаг, создающий текст только о работе сегодня*/
  createPlacemarkSchedule(fullInfo, todayOnly) {
    let htmlSchedule = '';
    const todaySchedule = fullInfo['today_schedule'];
    const schedule = fullInfo.schedule;
    const daysOfWeek = {
      '1': 'Пн',
      '2': 'Вт',
      '3': 'Ср',
      '4': 'Чт',
      '5': 'Пт',
      '6': 'Сб',
      '7': 'Вс',
    }
    /*Вспомогательная функция для создания строки, описывающей конкретный день
    * Параметры:
    * - start -- время начала работы
    * - stop -- время закрытия
    * - message -- сообщение, которое будет выведено если
    * достопримечательность не работает в данный момент*/
    const createTime = (start, stop, message) => {
      if (todayOnly) {
        if (fullInfo.working) {
          if (start && stop) {
            return `${start} - ${stop}`;
          }
          return 'Нет данных';
        }
        return message;
      }
      return `${start} - ${stop}`;
    };
    /*Вспомогательная функция для получения следующего дня открытия достопримечательности*/
    const getNextWorkingDay = () => {
      let today = todaySchedule['day_of_the_week'];
      for (let i = 1, l = schedule.length; i < l; i++) {
        /*Получение следующего дня (диапозон 1-7)*/
        let day = (today + i) % 8;
        if (!day) day++;
        /*Нахождение записи о следующем дне в расписании*/
        const nextDay = schedule.find((item) => item['day_of_the_week'] === day);
        if (nextDay) {
          return `${daysOfWeek[day]} ${nextDay['work_start']}`;
        }
      }
    };
    /*Если необходима информация только на сегодня*/
    if (todayOnly) {
      htmlSchedule = `${createTime(
        todaySchedule['work_start'],
        todaySchedule['work_stop'],
        `Закрыто до ${getNextWorkingDay()}`)
      }`;
    }
    else {
      /*Создание записи о каждом дне работы, при этом текущий день выделен жирным*/
      schedule.forEach((item) => {
        if (item['day_of_the_week'] === todaySchedule['day_of_the_week']) {
          htmlSchedule += `<b>${daysOfWeek[todaySchedule['day_of_the_week'].toString()]}: 
            ${createTime(todaySchedule['work_start'], todaySchedule['work_stop'])}</b><br/>`;
        } else {
          htmlSchedule += `<span>${daysOfWeek[item['day_of_the_week'].toString()]}: 
            ${createTime(item['work_start'], item['work_stop'])}</span><br/>`;
        }
      });
    }
    return htmlSchedule;
  },
  /*Создание подробного описания маршрута во всплывающем окне, построенного пользователем
  * Указывается протяженность, время в пути и способ добраться до каждой точки
  * Параметры:
  * - routeModel -- объект класса MultiRouteModel, описывающий созданный маршрут,
  * хранит подробную информауию, предоставляемую Яндексом*/
  createRouteHTMLContent(routeModel) {
    /*Получение точек маршрута*/
    const points = model.getRoutePoints();
    /*Заготовка под содержимое всплывающего окна*/
    let htmlContent = '<div style="display: flex; height: 100%; flex-direction: column"><div>';
    if (routeModel !== null) {
      /*Добавление информации о протяженности пути и времени, указывается начальная точка маршрута*/
      htmlContent += `Протяженность пути: ${routeModel.properties.get('distance').text}<br/>`+
       `Время в пути: ${routeModel.properties.get('duration').text}<br/></div><div style="overflow: auto">`+
       `<li>От «${points[0].name}»</li>`;
      /*Для каждого пути от точки А до Б*/
      routeModel.getPaths().forEach((path, pathIndex) => {
        /*Для каждого сегмента пути*/
        path.getSegments().forEach((segment, segIndex, segments) => {
          htmlContent += '<li>';
          /*Если конец пути, то добавляется точка, в которую пользователь попадет*/
          if (segIndex + 1 === segments.length) {
            htmlContent += `До «${points[pathIndex + 1].name}» `;
          }
          /*Если в свойствах сегмента есть информация о протяженности и времени в пути в готовом формате,
          * то добавляется в содержимое*/
          if (segment.properties.get('text')) {
            htmlContent += `${segment.properties.get('text')}</li>`
          }
          /*Иначе информация собирается вручную*/
          else {
            htmlContent += `${segment.properties.get('distance').text}, 
              ${segment.properties.get('duration').text}</li>`;
          }
        });
      });
    }
    htmlContent += '</div></div>';
    return htmlContent;
  },
  /*Изменяет текст кнопки
  * Параметры:
  * - id -- уникальный идентификатор кнопки (строка)
  * - text -- новый текст для кнопки (строка)*/
  changeButtonText(id, text) {
    const element = document.getElementById(id);
    if (element) element.innerText = text;
  },
  /*Создание обработчиков событий, связанных с метками достопримечательностей на карте. Функции обработки задаются
  * в объекте control
  * Обрабатываемые события:
  * - Нажатие на метку достопримечательности -- открытие всплывающего окна
  * - Закрытие всплывающего окна -- очистка неиспользуемых данных о достопримечательности*/
  initPlacemarkEvents() {
    const placemarks = model.getListOfObjects();
    placemarks.forEach((item) => {
      /*Добавление обработчиков событий нажатия на метку и закрытия всплывающего окна для каждой метки*/
      item.events.add('click', () => controller.openPlacemark(item));
      item.events.add('balloonclose', () => controller.closePlacemark(item));
    });
  },
  /*Создает html содержимое для выбранной в маршрут точки, а именно: информация о достопримечательности,
  * его изображение и элементы управления (перемещение достопримечательностей, удаление из маршрута)
  * Параметры:
  * - fullInfo -- объект, описывающий достопримечательность (объект имеет структуру:
  * id -- уникальный идентификатор достопримечательности (целое число)
  * name -- название достопримечательности (строка)
  * class -- тип достопримечательности (музей, парк и т.д.) (строка)
  * description -- описание достопримечательности (строка)
  * coord_longitude -- долгота (число с плавающей точкой)
  * coord_latitude -- широта (число с плавающей точкой)
  * rating -- рейтинг достопримечательности, полученный из открытых источников и основанный на отзывах посетителей
  * (число с плавающей точкой в диапозоне от 0 до 5)
  * cost -- стоимость посещения достопримечательности (если такой информации нет, то 0) (целое число))
  * - index -- индекс в списке достопримечательностей, добавленных в маршрут (целое число)
  * Возращает html содержимое достопримечательности в маршруте на карте (строка)*/
  makeHTMLElementForRoute(fullInfo, index) {
    /*Вспомогательная функция по созданию кнопок для управления достопримечательностями в маршруте
    * Параметры:
    * - id -- уникальный идентификатор достопримечательности
    * - buttonDescription -- объект, описывающий данные кнопки (функция, изображение и альтеранативное название)*/
    const makeButton = (id, buttonDescription) => {
      let htmlCode;
      if (buttonDescription) {
        htmlCode = `<th><button id="${buttonDescription.name}-${id}">
          <img src="img/UI/${buttonDescription.picName}.png" style="width: ${buttonDescription.width};
                        height: ${buttonDescription.height}" alt="${buttonDescription.altName}">
          </button></th>`;
      }
      else {
        htmlCode = '<th/>';
      }
      return htmlCode;
    }
    const empty = makeButton(); /*Несуществующая кнопка*/
    /*Кнопка для перемещения достопримечательности вниз*/
    const downButton = makeButton(fullInfo.id, {
      name: 'down',
      picName: 'down-arrow',
      altName: 'Вниз',
      width: '15px',
      height: '15px',
    });
    /*Кнопка для перемешения достопримечательности вниз*/
    const upButton = makeButton(fullInfo.id, {
      name: 'up',
      picName: 'up-arrow',
      altName: 'Вверх',
      width: '15px',
      height: '15px',
    });
    /*Кнопка для удаления достопримечательности из маршрута*/
    const deleteButton = makeButton(fullInfo.id, {
      name: 'delete',
      picName: 'bucket',
      altName: 'Удалить',
      width: '15px',
      height: '15px',
    });
    /*Получение параметров маршрута*/
    const length = model.getRouteLength();
    let code = '';
    const firstFixed = model.getRouteParam('firstFixed');
    const lastFixed = model.getRouteParam('lastFixed');
    /*Если длина маршрута меньше минимальной для появления элементов управления
    * (как минимум 2 достопримечательности, которые можно перемещать)*/
    if (length <= 1 + firstFixed + lastFixed) {
      code += empty + empty;
    }
    else {
      /*Если самая верхняя достопримечательность маршрута, которую можно двигать*/
      if (index === 0 + firstFixed) {
        code += downButton + empty;
      }
      /*Если самая нижняя достопримечательность маршрута, которую можно двигать*/
      else if (index === length - 1 - lastFixed) {
        code += empty + upButton;
      }
      /*Если достопримечательность находится в середине маршрута*/
      else if (index > 0 + firstFixed && index < length - 1 - lastFixed) {
        code += downButton + upButton;
      }
      /*Неопределенное поведение*/
      else {
        code += empty + empty;
      }
    }
    /*Добавление основной информации о маршруте*/
    code += view.createRouteTableContent(fullInfo, [110, 100, 100, 50, 60, 30, 60, 150]) + deleteButton;
    return code;
  },
  /*Инициализация кнопок на странице с сохраненными маршрутами*/
  initRoutePageButtons(routes) {
    /*Для каждого сохраненного маршрута*/
    routes.forEach((route, i) => {
      /*Инициалзиация кнопки "На карте"*/
      $(`#to-map-${i}`).bind('click', () => {
        /*Изменение текущей кнопки на новую в соответствии с типом выбранного маршрута*/
        const currentButton = model.getRouteParam('currentButton');
        const newButton = model.getButton(route.way);
        if (currentButton !== newButton) {
          currentButton.state.set('selected', false);
          newButton.state.set('selected', true);
          currentButton.options.set('selectOnClick', true);
          newButton.options.set('selectOnClick', false);
        }
        /*Выполнение логики вывода нового маршрута на основную страницу*/
        controller.routeToMap(route, newButton);
        /*Переключение на основную страницу*/
        document.getElementById('my-routes').hidden = true;
        document.getElementById('main-page').hidden = false;
        document.getElementById('profile-panel').hidden = true;
        document.getElementById('main-page').setAttribute('class', 'main-container');
      });
      /*Инициализация кнопки "Удалить"*/
      $(`#delete-${i}`).bind('click', () => {
        /*Удаление маршрута со страницы*/
        const routesList = document.getElementById('routes');
        routesList.removeChild(document.getElementById(`route-${i}`));
        /*Удаление маршрута из профиля пользователя*/
        controller.removeRoute(route.name);
        /*Если маршрутов не осталось - вывести соответствующее уведомление*/
        if (!routesList.children.length) {
          document.getElementById('empty-routes').hidden = false;
        }
      });
    })
  },
  /*Создание страницы с сохраненными маршрутами
  * Параметры:
  * - json -- список всех сохраненных пользователем маршрутов*/
  createRoutesPage(json) {
    const routesList = document.getElementById('routes');
    const emptyRoutes = document.getElementById('empty-routes');
    /*Если сохраненные маршруты есть*/
    if (json.length) {
      emptyRoutes.hidden = true;
      for (let i = 0, l = json.length; i < l; i++) {
        const route = json[i];
        /*Для каждого маршрута создается соответствующее описание и элементы управления*/
        routesList.innerHTML += `<div id="route-${i}">${view.createSingleRouteView(route)}</div><div style="display: flex; justify-content: center">
          <button id="to-map-${i}" class="route-options">На карте</button>
          <button id="delete-${i}" class="route-options">Удалить</button></div></div>`;
      }
    }
    else {
      emptyRoutes.hidden = false;
    }
  },
  /*Создание описания конкретного маршрута
  * Параметры:
  * - route -- объект, описывающий маршрут*/
  createSingleRouteView(route) {
    return `<h3>Маршрут ${route.name}</h3><div style="overflow-y: auto; max-height: 200px">
            ${view.createRouteTableView(route)}`;
  },
  /*Создание таблицы для вывода информации о маршруте
  * Параметры:
  * - route -- объект, описывающий маршрут*/
  createRouteTableView(route) {
    let contentHTML = `<table style="margin: 0 auto; table-layout: fixed; border-spacing: 10px;">`+
      /*Получение шапки таблицы*/
      `<thead><th/>${view.getTableHead()}</thead><tbody>`;
    /*Создание для каждой достопримечательнсти его описания*/
    for (let i = 0, l = route.points.length; i < l; i++) {
      contentHTML += `<tr>${view.createRouteTableContent(route.points[i],
        [110, 100, 100, 50, 60, 30, 60, 150])}</tr>`;
    }
    return  contentHTML + '</tbody></table>';
  },
  /*Создание описания достопримечательности для вывода на сайт
  * Параметры:
  * - fullInfo -- полное описание достопримечательности
  * - styleSizes -- список размеров ячеек таблицы
  * Формат описания достопримечательности в таблице (в строку):
  * - Фотография
  * - Название
  * - Тип
  * - Рейтинг
  * - Цена посещения
  * - Расписание на сегодня*/
  createRouteTableContent(fullInfo, styleSizes) {
    return `<td style='width: ${styleSizes[0]}px'>
      <img src='${fullInfo.photo}' style='width: ${styleSizes[1]}px; height ${styleSizes[2]}px' alt=''</td>
      <td style='width: ${styleSizes[3]}px'>${fullInfo.name}</td>
      <td style='width: ${styleSizes[4]}px'>${(fullInfo.class ? fullInfo.class : '-')}</td>
      <td style='width: ${styleSizes[5]}px'>${(fullInfo.rating ? fullInfo.rating : '-')}</td>
      <td style='width: ${styleSizes[6]}px'>${(fullInfo.cost ? `${fullInfo.cost}₽` : 'Бесплатно')}</td>
      <td style='width: ${styleSizes[7]}px'>${(fullInfo.schedule ?
      view.createPlacemarkSchedule(fullInfo, true) : 'Нет данных')}</td>`;
  },
  /*Полчение шапки таблицы для вывода маршрута*/
  getTableHead() {
    return "<th>Название</th>" +
      "<th>Вид</th><th>Рейтинг</th>" +
      "<th>Цена</th><th>Время работы (сегодня)</th>";
  },
  /*Пересоздает обработчки событий элементов управления достопримечательностей в маршруте*/
  rebindRouteEvent() {
    model.getRoutePoints().forEach((item) => {
      this.unbindRouteEvent(item.id);
      this.bindRouteEvent(item.id);
    });
  },
  /*Возвращает html содержимое для всего маршрута*/
  makeHTMLCodeForRoute() {
    let htmlCode = `<table style='margin: 0 auto; table-layout: fixed; border-spacing: 10px;'>
      <thead><th/><th/><th/>${view.getTableHead()}<th/></thead><tbody>`;
    model.getRoutePoints().forEach((item, index) => {
      htmlCode += `<tr>${this.makeHTMLElementForRoute(item, index)}</tr>`;
    });
    htmlCode += '</tbody></table>';
    return htmlCode;
  },
  /*Отображение маршрута и всех необходимых элементов на экране*/
  loadRoute() {
    /*Получение всех используемых элементов dom-дерева*/
    const table = document.getElementById('table');
    const routeNameField = document.getElementById('route-name-field');
    const saveRouteButton = document.getElementById('save-route');
    /*Получение параметров маршрута*/
    const name = model.getRouteParam('name');
    const length = model.getRouteLength();
    const maxLength = model.getRouteParam('maxPoints');
    /*Если в маршрут добавлена хотя бы одна точка*/
    if (model.getRouteLength()) {
      /*Создается содержимое для вывода на сайт*/
      table.innerHTML = this.makeHTMLCodeForRoute();
    } else {
      table.innerHTML = '';
    }
    /*Кнопка "Оптимизировать маршрут" выводится на экран,
    * если перемещать можно не менее 3-х точек маршрута*/
    document.getElementById('optimize-route-button').hidden = length < 3
      + model.getRouteParam('firstFixed') + model.getRouteParam('lastFixed');
    /*Кнопка очистки маршрута доступна только если в маршруте есть хотя бы одна точка*/
    document.getElementById('delete-route-button').hidden = length < 1;
    /*Уведомление, что маршрут пуст, если нет добавленных точек*/
    document.getElementById('empty-table').hidden = model.getRouteLength() > 0;
    /*Кнопка для сохранения маршрута доступна если маршрут не был еще
    * сохранен и количество точек находится в диапозоне 2-10*/
    saveRouteButton.disabled = !model.getRouteParam('unSaved')
      || length < 2 || length > model.getRouteParam('maxPoints');
    /*Подсказка при наведении на кнопку*/
    saveRouteButton.title = length < 2 ? 'Сохранить можно не менее 2 точек' :
      length > maxLength ? `Сохранить можно не более${maxLength}` : '';
    /*Поле для ввода названия маршрута доступно если имя еще
    * не было указано и сохранять маршрут можно*/
    routeNameField.hidden = !!name || saveRouteButton.disabled;
    /*Выводится название маршрута, если есть*/
    document.getElementById('route-name').innerText = name ? name : '';
    document.getElementById('route-name-label').hidden = routeNameField.hidden;
    /*Переопределение состояния флагов в зависимости от параметров маршрута*/
    document.getElementById('route-visible').checked = !model.getRouteParam('visible');
    document.getElementById('fix-first').checked = model.getRouteParam('firstFixed');
    document.getElementById('fix-last').checked = model.getRouteParam('lastFixed');
    /*Переопределение обработчиков событий*/
    this.rebindRouteEvent();
    /*Обновление маршрута, выводимого на карту*/
    controller.updateRoute();
  },
  /*Инициалзиация обработчиков событий элементов управления маршрутом*/
  initRouteControls() {
    /* Обработчик события нажатия на кнопку "Очистить маршрут"*/
    $('#delete-route').bind('click', () => {
      controller.deleteRoute(); // метод для удаления маршрута
    });
    /* Обработчик события нажатия на флажок "Скрыть маршрут с карты"*/
    $('#route-visible').bind('click', () => {
      controller.setRouteParams({
        /* устанавливает поле visible у маршрута в зависимости от состояния флажка*/
        visible: !document.getElementById('route-visible').checked,
      });
    });
    /* Обработчик события нажатия на флажок "Зафиксировать первую точку"*/
    $('#fix-first').bind('click', () => {
      controller.setRouteParams({
        /* устанавливает поле firstFixed у маршрута в зависимости от состояния флажка*/
        firstFixed: document.getElementById('fix-first').checked,
      });
    });
    /* Обработчик события нажатия на флажок "Зафиксировать последнюю точку"*/
    $('#fix-last').bind('click', () => {
      controller.setRouteParams({
        /* устанавливает поле lastFixed у маршрута в зависимости от состояния флажка*/
        lastFixed: document.getElementById('fix-last').checked,
      });
    });
    /* Обработчик события нажатия на флажок "Оптимизировать маршрут"*/
    $('#optimize-route').bind('click', () => {
      controller.optimizeRoute(); // метод для оптимизации маршрута
    });
    /*Обработчки события нажатия на кнопку "Сохранить маршрут"*/
    $('#save-route').bind('click', () => {
      /*Получени имени текущего маршрута*/
      const routeNameInput = document.getElementById('route-name-field');
      const name = model.getRouteParam('name') ? model.getRouteParam('name') :
        routeNameInput.value;
      if (name) {
        /*Сохранение маршрута в профиль*/
        controller.saveRoute(name);
        routeNameInput.value = '';
      }
      else {
        /*Уведомление пользователя, что имя не было введено*/
        alert('Введите имя маршрута');
      }
    });
    /*Обработчки события нажатия на кнопку "Назад" на экране с сохраненными
    * маршрутами*/
    $('#back-to-map').bind('click', () => {
      document.getElementById('routes').innerHTML = '';
      document.getElementById('my-routes').hidden = true;
      document.getElementById('main-page').hidden = false;
      document.getElementById('profile-panel').hidden = true;
      document.getElementById('main-page').setAttribute('class', 'main-container');
    });
  },
  /*Инициализация обработчиков событий, связанных с поисковой стокой
  * Параметры:
  * - searchControl -- объет класса SearchControl, описчающий поисковую строку*/
  initSearchControlEvents(searchControl) {
    /*Обработчик события очистки поиска*/
    searchControl.events.add('clear', () => {
      controller.clearSearch();
    });
    /*Обработчки события нажатия на один из результатов поиска*/
    searchControl.events.add('resultshow', (e) => {
      controller.showSearch(
        /*Получение из поисковой строки объекьта, по которому было совершено нажатие*/
        searchControl.getResultsArray()[e.get('index')].properties.get('id')
      );
    });
  },
  initMapControlButton(button) {
    button.events.add('click', () => {
      const currentButton = model.getRouteCurrentButton()
      if (button !== currentButton) {
        currentButton.state.set('selected', false);
        button.state.set('selected', true);
        currentButton.options.set('selectOnClick', true);
        button.options.set('selectOnClick', false);
        controller.changeRouteWay(button);
      }
    });
  },
  unbindRouteEvent(id) {
    $('#delete-' + id).unbind('click');
    $('#up-' + id).unbind('click');
    $('#down-' + id).unbind('click');
  },
  bindRouteEvent(id) {
    /*Обработчик события нажатия на кнопку
    * удаления точки изи маршрута,
    * расположенной в таблице с описанием
    * маршрута справа от карты*/
    $('#delete-' + id).bind('click', () => {
      /*Получение кнопки добавления/удаления
      * точки в маршрут, расположенной во всплывающем окне*/
      const element = document.getElementById('select-placemark');
      /*Если данный элемент существует, то
      * текст заменяется (то есть если
      * всплывающее окно открыто)*/
      if (element)
        element.innerText = 'Добавить в маршрут';
      controller.removePlacemarkFromRoute(id);
    });
    $('#up-' + id).bind('click', () => {
      controller.swapPlacemarksInRoute(id, -1);
    });
    $('#down-' + id).bind('click', () => {
      controller.swapPlacemarksInRoute(id, 1);
    });
  },
  loggedInOut() {
    const topMenuAuthorize = document.getElementById('dropdown_authorize');
    const topMenuProfile = document.getElementById('dropdown_profile');
    const saveRouteButton = document.getElementById('save-route-button');
    topMenuAuthorize.hidden = !topMenuAuthorize.hidden;
    topMenuProfile.hidden = !topMenuProfile.hidden;
    saveRouteButton.hidden = !saveRouteButton.hidden;
    document.getElementById('user-login').innerText = model.getLogin() ? model.getLogin() : '';
  },
  initProfileButtons() {
    const errorField = document.getElementById('error-text');
    const passwordField1 = document.getElementById('password');
    const passwordField2 = document.getElementById('again-password');
    const emailField = document.getElementById('email');
    const loginField = document.getElementById('login');
    const authorizedPanel = document.getElementById('authorize-panel');
    const profilePanel = document.getElementById('profile-panel');
    $('#reg-log').bind('click', () => {
      errorField.innerText = '';
      authorizedPanel.hidden = !authorizedPanel.hidden;
      passwordField1.value = '';
      passwordField2.value = '';
    });
    $('#reg-log-switch').bind('click', () => {
      passwordField2.hidden = !passwordField2.hidden;
      emailField.hidden = !emailField.hidden;
      const passwordLabel = document.getElementById('label-again-password');
      const emailLabel = document.getElementById('label-email');
      passwordLabel.hidden = !passwordLabel.hidden;
      emailLabel.hidden = !emailLabel.hidden;
      if (passwordField2.hidden) {
        document.getElementById('panel-main-text').innerText = 'Вход';
        document.getElementById('reg-log-switch').innerText = 'Зарегистрироваться';
        document.getElementById('enter-button').innerText = 'Войти';
        document.getElementById('question-text').innerText = 'Еще нет аккаунта?';
      }
      else {
        document.getElementById('panel-main-text').innerText = 'Регистрация';
        document.getElementById('reg-log-switch').innerText = 'Войти';
        document.getElementById('enter-button').innerText = 'Зарегистрироваться';
        document.getElementById('question-text').innerText = 'Уже есть аккаунт?';
      }
      passwordField1.value = '';
      passwordField2.value = '';
      errorField.innerText = '';
    });
    $('#profile').bind('click', () => {
      profilePanel.hidden = !profilePanel.hidden;
    });
    $('#to-map-routes').bind('click', () => {
      const routesPage = document.getElementById('my-routes');
      if (routesPage.hidden) {
        routesPage.hidden = false;
        profilePanel.hidden = true;
        document.getElementById('routes').innerHTML = '';
        document.getElementById('empty-routes').hidden = false;
        document.getElementById('main-page').setAttribute('class', '');
        document.getElementById('main-page').hidden = true;
        controller.getSaveRoutes();
      }
    });
    $('#quit-button').bind('click', () => {
      const mainPage = document.getElementById('main-page');
      profilePanel.hidden = !profilePanel.hidden;
      loginField.value = '';
      document.getElementById('my-routes').hidden = true;
      mainPage.hidden = false;
      mainPage.setAttribute('class', 'main-container');
      controller.quit();
    });
    $('#enter-button').bind('click', () => {
      const login = loginField.value;
      const email = emailField.value;
      const password1 = passwordField1.value;
      const password2 = passwordField2.value;
      passwordField1.value = '';
      passwordField2.value = '';
      if (passwordField2.hidden) {
        if (login) {
          if (password1) {
            controller.login(login, password1);
            authorizedPanel.hidden = !authorizedPanel.hidden;
          }
          else {
            errorField.innerText = 'Введите пароль';
          }
        }
        else {
          errorField.innerText = 'Введите логин';
        }
      }
      else {
        if (login) {
          if (email) {
            if (password1) {
              if (password1 === password2) {
                controller.registration(login, email, password1);
                authorizedPanel.hidden = !authorizedPanel.hidden;
              }
              else {
                errorField.innerText = 'Введенные пароли не совпадают';
              }
            }
            else {
              errorField.innerText = 'Введите пароль';
            }
          }
          else {
            errorField.innerText = 'Введите почту';
          }
        }
        else {
          errorField.innerText = 'Введите логин';
        }
      }
    });
  },
  initRouteEvents() {
    // Получение текущего маршрута на карте
    const route = model.getRouteOnMap();
    // Если маршрут существует
    if (route) {
      /*Добавляется обработчки события нажатия на маршрут
      * В этом случае на карте появится всплывающее окно
      * содержимое которого создается с помощью метода
      * createRouteHTMLContent и помещается в параметр
      * routeActiveBalloonContentLayout*/
      route.events.add('click', () => {
        route.options.set('routeActiveBalloonContentLayout', ymaps.templateLayoutFactory.createClass(
          view.createRouteHTMLContent(route.getActiveRoute().model)
        ));
      });
    }
  }
}