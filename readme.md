# tgrabber

Вам нужно создать `config.json` в папке с программой со следующим содежанием

    {
      "groupId": "ID группы",
      "clientId": "ID приложения ВК",
      "clientSecret": "секрет приложения",
      "defaultTags": []
    }
    
В итоге должно получиться что-то вроде этого

    {
      "groupId": "000000000",
      "clientId": "5560324",
      "clientSecret": "22lkEAYWuwgUebfaqXb8",
      "defaultTags": [
        "stevenuniverse"
      ]
    }
    
При первом запуске предложит сгенерировать токен доступа к вашему аккаунту

----

#### Установка

    git clone https://github.com/fortael/tgrabber.git tgrabber
    
Или скачать и распаковать  

Установить [node.js](https://nodejs.org/en/)

     cd tgrabber
     npm install

Запуск

    npm run start

![example](https://github.com/fortael/tgrabber/blob/master/example.gif?raw=true)