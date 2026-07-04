// Global 3-level regional hierarchy for agent sub-accounts
// Format: { country: { province: [city1, city2, ...] } }
// Empty cities array means no subdivision (small countries)
window.GLOBAL_REGIONS = {
  // --- Asia Pacific ---
  '中国': {
    '北京市': ['东城区','西城区','朝阳区','海淀区','丰台区','通州区','大兴区','顺义区','昌平区'],
    '上海市': ['黄浦区','徐汇区','长宁区','静安区','浦东新区','闵行区','宝山区','嘉定区'],
    '广东省': ['广州市','深圳市','东莞市','佛山市','珠海市','惠州市','汕头市','湛江市','茂名市','肇庆市','江门市','清远市','韶关市'],
    '浙江省': ['杭州市','宁波市','温州市','嘉兴市','湖州市','绍兴市','金华市','台州市','丽水市'],
    '江苏省': ['南京市','苏州市','无锡市','常州市','南通市','徐州市','扬州市','镇江市','泰州市'],
    '山东省': ['济南市','青岛市','烟台市','潍坊市','临沂市','济宁市','淄博市','威海市'],
    '四川省': ['成都市','绵阳市','德阳市','宜宾市','南充市','泸州市','乐山市','达州市'],
    '湖北省': ['武汉市','宜昌市','襄阳市','荆州市','黄冈市','十堰市','孝感市'],
    '湖南省': ['长沙市','株洲市','湘潭市','衡阳市','岳阳市','常德市','郴州市'],
    '福建省': ['福州市','厦门市','泉州市','漳州市','莆田市','龙岩市','三明市'],
    '河南省': ['郑州市','洛阳市','开封市','南阳市','许昌市','新乡市','安阳市'],
    '河北省': ['石家庄市','唐山市','保定市','邯郸市','廊坊市','沧州市','邢台市'],
    '安徽省': ['合肥市','芜湖市','蚌埠市','马鞍山市','安庆市','滁州市','阜阳市'],
    '辽宁省': ['沈阳市','大连市','鞍山市','抚顺市','丹东市','锦州市','营口市'],
    '陕西省': ['西安市','宝鸡市','咸阳市','渭南市','延安市','汉中市','榆林市'],
    '重庆市': ['渝中区','江北区','沙坪坝区','九龙坡区','南岸区','渝北区','巴南区','万州区'],
    '天津市': ['和平区','河东区','河西区','南开区','河北区','滨海新区'],
    '香港': ['中西区','湾仔区','东区','南区','油尖旺区','深水埗区','九龙城区','观塘区'],
    '台湾': ['台北市','新北市','台中市','高雄市','台南市','桃园市','新竹市','基隆市'],
    '澳门': ['澳门半岛','氹仔','路环']
  },
  '日本': {
    '東京都': ['千代田区','中央区','港区','新宿区','文京区','台東区','墨田区','江東区','品川区','目黒区','大田区','世田谷区','渋谷区','中野区','杉並区','豊島区','北区','荒川区','板橋区','練馬区'],
    '大阪府': ['大阪市','堺市','岸和田市','豊中市','池田市','吹田市','高槻市','枚方市','茨木市','八尾市'],
    '神奈川県': ['横浜市','川崎市','相模原市','横須賀市','平塚市','鎌倉市','藤沢市','小田原市'],
    '愛知県': ['名古屋市','豊橋市','岡崎市','一宮市','瀬戸市','春日井市','豊田市'],
    '北海道': ['札幌市','函館市','小樽市','旭川市','室蘭市','釧路市','帯広市'],
    '福岡県': ['福岡市','北九州市','久留米市','大牟田市','飯塚市']
  },
  '韩国': {
    '首尔': ['江南区','瑞草区','松坡区','江东区','麻浦区','龙山区','钟路区','中区','城东区','广津区'],
    '京畿道': ['水原市','城南市','高阳市','龙仁市','富川市','安山市','安养市','光明市'],
    '釜山': ['海云台区','南区','北区','东区','西区','中区','影岛区'],
    '仁川': ['中区','东区','南区','延寿区','南洞区','富平区','桂阳区','西区'],
    '大邱': ['中区','东区','西区','南区','北区','寿城区','达西区']
  },
  '印度': {
    'Maharashtra': ['Mumbai','Pune','Nagpur','Thane','Nashik','Aurangabad'],
    'Delhi': ['New Delhi','Central Delhi','South Delhi','East Delhi','North Delhi'],
    'Karnataka': ['Bengaluru','Mysuru','Hubli','Mangaluru','Belagavi'],
    'Tamil Nadu': ['Chennai','Coimbatore','Madurai','Tiruchirappalli','Salem'],
    'Telangana': ['Hyderabad','Warangal','Nizamabad','Karimnagar'],
    'Gujarat': ['Ahmedabad','Surat','Vadodara','Rajkot','Bhavnagar'],
    'Uttar Pradesh': ['Lucknow','Kanpur','Agra','Varanasi','Prayagraj','Noida']
  },
  '新加坡': { 'Singapore': ['Central','North East','North West','South East','South West'] },
  '马来西亚': {
    '吉隆坡': ['KLCC','Bukit Bintang','Cheras','Kepong','Bangsar'],
    '雪兰莪': ['Petaling','Klang','Shah Alam','Subang Jaya','Kajang'],
    '槟城': ['George Town','Butterworth','Bukit Mertajam'],
    '柔佛': ['Johor Bahru','Batu Pahat','Muar','Kluang']
  },
  '泰国': {
    '曼谷': ['Pathum Wan','Watthana','Bang Rak','Sathon','Chatuchak','Huai Khwang','Sukhumvit'],
    '清迈': ['Mueang','San Sai','Hang Dong','Saraphi'],
    '普吉': ['Mueang','Kathu','Thalang'],
    '春武里': ['Pattaya','Bang Lamung','Si Racha','Mueang']
  },
  '越南': {
    '胡志明市': ['District 1','District 2','District 3','District 5','District 7','Binh Thanh','Phu Nhuan'],
    '河内': ['Hoan Kiem','Ba Dinh','Dong Da','Hai Ba Trung','Cau Giay','Tay Ho'],
    '岘港': ['Hai Chau','Thanh Khe','Son Tra','Ngu Hanh Son']
  },
  '印度尼西亚': {
    '雅加达': ['Central Jakarta','South Jakarta','West Jakarta','East Jakarta','North Jakarta'],
    '巴厘': ['Denpasar','Badung','Gianyar','Tabanan'],
    '西爪哇': ['Bandung','Bekasi','Depok','Bogor']
  },
  '菲律宾': {
    '马尼拉': ['Manila','Makati','Pasig','Quezon City','Taguig','Parañaque'],
    '宿务': ['Cebu City','Mandaue','Lapu-Lapu','Talisay']
  },
  '澳大利亚': {
    'New South Wales': ['Sydney','Newcastle','Wollongong','Central Coast'],
    'Victoria': ['Melbourne','Geelong','Ballarat','Bendigo'],
    'Queensland': ['Brisbane','Gold Coast','Sunshine Coast','Cairns','Townsville'],
    'Western Australia': ['Perth','Fremantle','Bunbury'],
    'South Australia': ['Adelaide','Mount Gambier']
  },
  '新西兰': {
    'Auckland': ['Auckland City','Waitakere','Manukau','North Shore'],
    'Wellington': ['Wellington City','Lower Hutt','Upper Hutt','Porirua'],
    'Canterbury': ['Christchurch','Timaru']
  },

  // --- Americas ---
  '美国': {
    'California': ['Los Angeles','San Francisco','San Diego','San Jose','Sacramento','Oakland'],
    'New York': ['New York City','Buffalo','Rochester','Albany','Syracuse'],
    'Texas': ['Houston','Dallas','Austin','San Antonio','Fort Worth','El Paso'],
    'Florida': ['Miami','Orlando','Tampa','Jacksonville','Fort Lauderdale'],
    'Illinois': ['Chicago','Aurora','Naperville','Springfield','Peoria'],
    'Washington': ['Seattle','Bellevue','Tacoma','Spokane','Redmond'],
    'Massachusetts': ['Boston','Cambridge','Worcester','Springfield'],
    'Nevada': ['Las Vegas','Reno','Henderson'],
    'Georgia': ['Atlanta','Augusta','Columbus','Savannah'],
    'Colorado': ['Denver','Colorado Springs','Boulder','Aurora']
  },
  '加拿大': {
    'Ontario': ['Toronto','Ottawa','Mississauga','Hamilton','London'],
    'Quebec': ['Montreal','Quebec City','Laval','Gatineau'],
    'British Columbia': ['Vancouver','Victoria','Surrey','Burnaby','Richmond'],
    'Alberta': ['Calgary','Edmonton','Red Deer']
  },
  '墨西哥': {
    'Ciudad de México': ['Coyoacán','Cuauhtémoc','Miguel Hidalgo','Benito Juárez','Álvaro Obregón'],
    'Jalisco': ['Guadalajara','Zapopan','Puerto Vallarta'],
    'Nuevo León': ['Monterrey','San Pedro','Guadalupe'],
    'Quintana Roo': ['Cancún','Playa del Carmen','Tulum']
  },
  '巴西': {
    'São Paulo': ['São Paulo','Campinas','São Bernardo do Campo','Santo André'],
    'Rio de Janeiro': ['Rio de Janeiro','Niterói','Petrópolis'],
    'Brasília': ['Plano Piloto','Taguatinga','Águas Claras'],
    'Bahia': ['Salvador','Porto Seguro'],
    'Minas Gerais': ['Belo Horizonte','Uberlândia']
  },
  '阿根廷': {
    'Buenos Aires': ['Buenos Aires City','La Plata','Mar del Plata'],
    'Córdoba': ['Córdoba','Villa Carlos Paz'],
    'Santa Fe': ['Rosario','Santa Fe']
  },

  // --- Europe ---
  '英国': {
    'England': ['London','Manchester','Birmingham','Liverpool','Leeds','Sheffield','Bristol','Oxford','Cambridge'],
    'Scotland': ['Edinburgh','Glasgow','Aberdeen','Dundee'],
    'Wales': ['Cardiff','Swansea','Newport'],
    'Northern Ireland': ['Belfast','Derry']
  },
  '法国': {
    'Île-de-France': ['Paris','Boulogne-Billancourt','Saint-Denis','Versailles'],
    'Auvergne-Rhône-Alpes': ['Lyon','Grenoble','Saint-Étienne'],
    'Provence-Alpes-Côte d\'Azur': ['Marseille','Nice','Toulon','Cannes'],
    'Occitanie': ['Toulouse','Montpellier'],
    'Nouvelle-Aquitaine': ['Bordeaux'],
    'Hauts-de-France': ['Lille']
  },
  '德国': {
    'Berlin': ['Mitte','Charlottenburg','Kreuzberg','Neukölln','Prenzlauer Berg'],
    'Bayern': ['München','Nürnberg','Augsburg','Regensburg'],
    'Nordrhein-Westfalen': ['Köln','Düsseldorf','Dortmund','Essen','Bonn'],
    'Hamburg': ['Hamburg-Mitte','Altona','Eimsbüttel','Hamburg-Nord'],
    'Hessen': ['Frankfurt','Wiesbaden'],
    'Baden-Württemberg': ['Stuttgart','Karlsruhe','Mannheim']
  },
  '意大利': {
    'Lazio': ['Roma'],
    'Lombardia': ['Milano','Bergamo','Brescia'],
    'Campania': ['Napoli','Salerno'],
    'Toscana': ['Firenze','Pisa','Siena'],
    'Veneto': ['Venezia','Verona','Padova'],
    'Piemonte': ['Torino']
  },
  '西班牙': {
    'Madrid': ['Madrid','Alcalá de Henares','Móstoles'],
    'Cataluña': ['Barcelona','Girona','Tarragona'],
    'Andalucía': ['Sevilla','Málaga','Granada','Córdoba','Marbella'],
    'Comunidad Valenciana': ['Valencia','Alicante','Benidorm'],
    'País Vasco': ['Bilbao','San Sebastián','Vitoria']
  },
  '荷兰': {
    'Noord-Holland': ['Amsterdam','Haarlem','Zaandam'],
    'Zuid-Holland': ['Rotterdam','Den Haag','Leiden','Delft'],
    'Utrecht': ['Utrecht','Amersfoort'],
    'Noord-Brabant': ['Eindhoven','Tilburg','Breda']
  },
  '瑞士': {
    'Zürich': ['Zürich','Winterthur'],
    'Genève': ['Genève','Carouge'],
    'Bern': ['Bern','Biel'],
    'Vaud': ['Lausanne','Montreux'],
    'Basel-Stadt': ['Basel']
  },
  '瑞典': {
    'Stockholm': ['Stockholm','Solna','Sundbyberg','Södertälje'],
    'Västra Götaland': ['Göteborg','Borås'],
    'Skåne': ['Malmö','Lund','Helsingborg']
  },
  '俄罗斯': {
    'Москва': ['Центральный','Северный','Восточный','Южный','Западный'],
    'Санкт-Петербург': ['Центральный','Василеостровский','Петроградский','Выборгский'],
    'Московская область': ['Химки','Балашиха','Подольск','Красногорск']
  },

  // --- Middle East & Africa ---
  '阿联酋': {
    'Dubai': ['Bur Dubai','Deira','Jumeirah','Dubai Marina','Downtown','Palm Jumeirah'],
    'Abu Dhabi': ['Abu Dhabi City','Al Ain','Al Dhafra'],
    'Sharjah': ['Sharjah City','Khor Fakkan']
  },
  '沙特阿拉伯': {
    'Riyadh': ['Riyadh City','Al Olaya','Al Malaz'],
    'Jeddah': ['Jeddah City','Al Balad'],
    'Makkah': ['Makkah City','Al Aziziyah'],
    'Dammam': ['Dammam City','Al Khobar']
  },
  '以色列': {
    'Tel Aviv': ['Tel Aviv','Jaffa','Ramat Gan','Herzliya'],
    'Jerusalem': ['Jerusalem'],
    'Haifa': ['Haifa']
  },
  '土耳其': {
    'İstanbul': ['Beşiktaş','Kadıköy','Şişli','Beyoğlu','Üsküdar','Sarıyer'],
    'Ankara': ['Çankaya','Keçiören'],
    'İzmir': ['Konak','Karşıyaka','Bornova'],
    'Antalya': ['Muratpaşa','Konyaaltı']
  },
  '南非': {
    'Gauteng': ['Johannesburg','Pretoria','Sandton','Midrand'],
    'Western Cape': ['Cape Town','Stellenbosch'],
    'KwaZulu-Natal': ['Durban','Pietermaritzburg']
  },
  '尼日利亚': {
    'Lagos': ['Ikeja','Lagos Island','Lekki','Victoria Island','Surulere'],
    'Abuja': ['Abuja Municipal','Garki','Wuse'],
    'Rivers': ['Port Harcourt']
  },
  '埃及': {
    'Cairo': ['Nasr City','Maadi','Zamalek','Heliopolis','New Cairo'],
    'Alexandria': ['Alexandria City'],
    'Giza': ['Giza City','6th of October']
  },
  '肯尼亚': {
    'Nairobi': ['Nairobi City','Westlands','Karen'],
    'Mombasa': ['Mombasa City']
  },

  // --- Others ---
  '哈萨克斯坦': {
    'Almaty': ['Almaty City','Medeu','Bostandyk'],
    'Astana': ['Astana City','Yesil','Saryarka']
  },
  '巴基斯坦': {
    'Sindh': ['Karachi','Hyderabad'],
    'Punjab': ['Lahore','Faisalabad','Rawalpindi','Multan'],
    'Islamabad': ['Islamabad City']
  },
  '孟加拉国': {
    'Dhaka': ['Dhaka City','Gulshan','Banani','Uttara','Mirpur'],
    'Chittagong': ['Chittagong City']
  }
};

// Helpers
function getGlobalCountries() { return Object.keys(window.GLOBAL_REGIONS); }
function getGlobalProvinces(country) {
  var c = window.GLOBAL_REGIONS[country];
  return c ? Object.keys(c) : [];
}
function getGlobalCities(country, province) {
  var c = window.GLOBAL_REGIONS[country];
  if (!c) return [];
  return c[province] || [];
}
