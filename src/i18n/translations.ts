export type Lang = 'uz' | 'ru'

export const T: Record<Lang, Record<string, string>> = {
  uz: {
    // nav
    'nav.dashboard': 'Dashboard',
    'nav.agents': 'Agentlar',
    'nav.analytics': 'Tahlil',
    'nav.orders': 'Buyurtmalar',
    'nav.tv_mode': 'TV rejimi',
    'nav.company': 'Kompaniya',

    // kpi
    'kpi.orders': 'Buyurtmalar soni',
    'kpi.revenue': 'Daromad',
    'kpi.avg_check': "O'rtacha chek",
    'kpi.active_agents': 'Faol agentlar',
    'kpi.active_deliveries': 'Faol yetkazishlar',
    'kpi.delivered': 'Yetkazildi',
    'kpi.pending': 'Kutilmoqda',
    'kpi.delivery_rate': 'Yetkazish darajasi',
    'kpi.cancelled': 'Bekor qilindi',
    'kpi.vs_prev': 'oldingi davr bilan',

    // header
    'header.refresh': 'Yangilash',
    'header.live': 'Jonli',
    'header.updated_at': 'Yangilandi',
    'header.loading': 'Yuklanmoqda...',
    'header.today': 'Bugun',
    'header.yesterday': 'Kecha',
    'header.this_week': 'Bu hafta',
    'header.this_month': 'Bu oy',
    'header.created_date': 'Yaratilgan sana',
    'header.delivery_date': 'Yetkazish sanasi',
    'header.filters': 'Filtrlar',
    'header.clear_filters': 'Filtrlarni tozalash',
    'header.language': 'Til',

    // filters
    'agent_filter': 'Agent',
    'region_filter': 'Hudud',
    'payment_filter': "To'lov turi",
    'delivery_filter': 'Yetkazish holati',
    'status_filter': 'Holat',
    'all_items': 'Barchasi',

    // marathon
    'marathon.title': 'Sotish marafoni',
    'marathon.agents_count': 'Agentlar soni',
    'marathon.top_agents': 'Top agentlar',
    'marathon.orders_count': 'Buyurtmalar',
    'marathon.sum': 'Summa',
    'marathon.avg_check': "O'rtacha chek",
    'marathon.delivered': 'Yetkazildi',
    'marathon.pending': 'Kutilmoqda',
    'marathon.clients': 'Mijozlar',
    'marathon.rank': "O'rin",
    'marathon.weight': 'Vazn (kg)',

    // live
    'live.title': 'Jonli lenta',
    'live.realtime': 'Real vaqt',
    'live.new_order': 'Yangi buyurtma',

    // status
    'status.0': 'Yangi',
    'status.1': 'Tasdiqlangan',
    'status.2': "Jarayonda",
    'status.3': "Yo'lda",
    'status.4': 'Qaytarilgan',
    'status.5': 'Yetkazildi',
    'status.6': 'Bekor qilindi',

    // payment
    'payment.cash': 'Naqd',
    'payment.bank': 'Bank',
    'payment.other': 'Boshqa',

    // nav (new pages)
    'nav.deliveries': 'Yetkazishlar',
    'nav.clients': 'Mijozlar',
    'nav.screen': 'Ekran tahlil',

    // chart
    'chart.hourly_title': 'Soatlik buyurtmalar',
    'chart.daily_title': 'Kunlik tahlil',
    'chart.agents_title': 'Agentlar reytingi',
    'chart.regional_title': 'Hududlar bo\'yicha',
    'chart.payments_title': "To'lov turlari",
    'chart.orders_axis': 'Buyurtmalar',
    'chart.sum_axis': 'Summa',
    'chart.hour_axis': 'Soat',
    'chart.weekday_title': 'Hafta kunlari bo\'yicha',
    'chart.weekday_hint': 'o\'rtacha buyurtma/kun',
    'chart.weekday_avg': 'O\'rtacha/kun',
    'chart.weekday_total': 'Jami',
    'chart.market_type_title': 'Bozor turi bo\'yicha',
    'chart.deliveries_top8': 'Top-8 yetkazuvchi',
    'chart.deliveries_dist': 'Yetkazuvchilar reytingi',

    // weekday names
    'weekday.1': 'Du', 'weekday.2': 'Se', 'weekday.3': 'Ch',
    'weekday.4': 'Pa', 'weekday.5': 'Ju', 'weekday.6': 'Sh', 'weekday.7': 'Ya',

    // table
    'table.order_num': 'Buyurtma №',
    'table.client': 'Mijoz',
    'table.agent': 'Agent',
    'table.delivery_man': 'Yetkazuvchi',
    'table.amount': 'Summa',
    'table.status': 'Holat',
    'table.payment': "To'lov",
    'table.delivery_date': 'Yetkazish sanasi',
    'table.created_date': 'Yaratilgan',
    'table.weight': 'Vazn',
    'table.weight_col': 'Vazn (kg)',
    'table.regions_col': 'Hududlar',
    'table.search_placeholder': 'Qidirish...',
    'table.export': 'Eksport',
    'table.results_count': 'Natijalar',
    'table.all_statuses': 'Barcha holatlar',
    'table.delivery_rate_col': 'Yetkazish %',
    'table.share_col': 'Ulush %',
    'table.avg_order_col': "O'rtacha buyurtma",
    'table.rank_col': "O'rin",
    'table.trend_col': 'Trend',
    'table.agents_title': 'Agentlar jadvali',
    'table.deliveries_title': 'Yetkazuvchilar jadvali',
    'table.orders_count_col': 'Buyurtmalar soni',

    // analytics
    'analytics.total_revenue': 'Umumiy daromad',
    'analytics.peak_hour': 'Eng faol soat',
    'analytics.top_agent': 'Eng yaxshi agent',
    'analytics.top_client': 'Eng yaxshi mijoz',
    'analytics.top_n_clients': 'Top {n} ta mijoz',
    'analytics.daily_stats': 'Kunlik statistika',
    'analytics.date_col': 'Sana',
    'analytics.status_dist': "Holat bo'yicha taqsimot",

    // orders page
    'orders_page.total': 'Jami buyurtmalar',
    'orders_page.delivered_count': 'Yetkazildi',
    'orders_page.pending_count': 'Kutilmoqda',
    'orders_page.revenue': 'Daromad',

    // tv mode
    'tv.title': 'TV rejimi',
    'tv.description': "To'liq ekran ko'rsatish",
    'tv.start_btn': 'Boshlash',
    'tv.exit_hint': "Chiqish uchun ESC bosing",
    'tv.marathon_slide': 'Marafon',
    'tv.kpi_slide': 'KPI',
    'tv.analytics_slide': 'Tahlil',
    'tv.clients_slide': 'Mijozlar',

    // general
    'general.loading': 'Yuklanmoqda...',
    'general.error': 'Xatolik yuz berdi',
    'general.retry': 'Qayta urinish',
    'general.som': "so'm",
    'general.orders_unit': 'ta',
    'general.no_data': "Ma'lumot yo'q",
    'general.agents_unit': 'agent',

    // alerts
    'alerts.backend_error': 'Server bilan bog\'lanishda xatolik',
    'alerts.sales_drop_20': "Sotuvlar 20% ga tushdi!",

    // data management
    'data.title': "Ma'lumotlar boshqaruvi",
  },

  ru: {
    // nav
    'nav.dashboard': 'Дашборд',
    'nav.agents': 'Агенты',
    'nav.deliveries': 'Доставки',
    'nav.clients': 'Клиенты',
    'nav.screen': 'Экран аналитика',
    'nav.analytics': 'Аналитика',
    'nav.orders': 'Заказы',
    'nav.tv_mode': 'TV режим',
    'nav.company': 'Компания',

    // kpi
    'kpi.orders': 'Количество заказов',
    'kpi.revenue': 'Выручка',
    'kpi.avg_check': 'Средний чек',
    'kpi.active_agents': 'Активные агенты',
    'kpi.active_deliveries': 'Активные доставки',
    'kpi.delivered': 'Доставлено',
    'kpi.pending': 'Ожидание',
    'kpi.delivery_rate': 'Процент доставки',
    'kpi.cancelled': 'Отменено',
    'kpi.vs_prev': 'к предыдущему периоду',

    // header
    'header.refresh': 'Обновить',
    'header.live': 'Онлайн',
    'header.updated_at': 'Обновлено',
    'header.loading': 'Загрузка...',
    'header.today': 'Сегодня',
    'header.yesterday': 'Вчера',
    'header.this_week': 'Эта неделя',
    'header.this_month': 'Этот месяц',
    'header.created_date': 'Дата создания',
    'header.delivery_date': 'Дата доставки',
    'header.filters': 'Фильтры',
    'header.clear_filters': 'Сбросить фильтры',
    'header.language': 'Язык',

    // filters
    'agent_filter': 'Агент',
    'region_filter': 'Регион',
    'payment_filter': 'Тип оплаты',
    'delivery_filter': 'Статус доставки',
    'status_filter': 'Статус',
    'all_items': 'Все',

    // marathon
    'marathon.title': 'Марафон продаж',
    'marathon.agents_count': 'Количество агентов',
    'marathon.top_agents': 'Топ агентов',
    'marathon.orders_count': 'Заказы',
    'marathon.sum': 'Сумма',
    'marathon.avg_check': 'Средний чек',
    'marathon.delivered': 'Доставлено',
    'marathon.pending': 'Ожидание',
    'marathon.clients': 'Клиенты',
    'marathon.rank': 'Место',
    'marathon.weight': 'Вес (кг)',

    // live
    'live.title': 'Живая лента',
    'live.realtime': 'Реальное время',
    'live.new_order': 'Новый заказ',

    // status
    'status.0': 'Новый',
    'status.1': 'Подтверждён',
    'status.2': 'В обработке',
    'status.3': 'В пути',
    'status.4': 'Возвращён',
    'status.5': 'Доставлен',
    'status.6': 'Отменён',

    // payment
    'payment.cash': 'Наличные',
    'payment.bank': 'Банк',
    'payment.other': 'Другое',

    // chart
    'chart.hourly_title': 'Заказы по часам',
    'chart.daily_title': 'Дневная аналитика',
    'chart.agents_title': 'Рейтинг агентов',
    'chart.regional_title': 'По регионам',
    'chart.payments_title': 'Типы оплаты',
    'chart.orders_axis': 'Заказы',
    'chart.sum_axis': 'Сумма',
    'chart.hour_axis': 'Час',
    'chart.weekday_title': 'По дням недели',
    'chart.weekday_hint': 'среднее заказов/день',
    'chart.weekday_avg': 'Среднее/день',
    'chart.weekday_total': 'Всего',
    'chart.market_type_title': 'По типу рынка',
    'chart.deliveries_top8': 'Топ-8 доставщиков',
    'chart.deliveries_dist': 'Рейтинг доставщиков',

    // weekday names
    'weekday.1': 'Пн', 'weekday.2': 'Вт', 'weekday.3': 'Ср',
    'weekday.4': 'Чт', 'weekday.5': 'Пт', 'weekday.6': 'Сб', 'weekday.7': 'Вс',

    // table
    'table.order_num': 'Заказ №',
    'table.client': 'Клиент',
    'table.agent': 'Агент',
    'table.delivery_man': 'Доставщик',
    'table.amount': 'Сумма',
    'table.status': 'Статус',
    'table.payment': 'Оплата',
    'table.delivery_date': 'Дата доставки',
    'table.created_date': 'Дата создания',
    'table.weight': 'Вес',
    'table.weight_col': 'Вес (кг)',
    'table.regions_col': 'Регионы',
    'table.search_placeholder': 'Поиск...',
    'table.export': 'Экспорт',
    'table.results_count': 'Результатов',
    'table.all_statuses': 'Все статусы',
    'table.delivery_rate_col': 'Доставка %',
    'table.share_col': 'Доля %',
    'table.avg_order_col': 'Средний заказ',
    'table.rank_col': 'Место',
    'table.trend_col': 'Тренд',
    'table.agents_title': 'Таблица агентов',
    'table.deliveries_title': 'Таблица доставщиков',
    'table.orders_count_col': 'Количество заказов',

    // analytics
    'analytics.total_revenue': 'Общая выручка',
    'analytics.peak_hour': 'Пиковый час',
    'analytics.top_agent': 'Лучший агент',
    'analytics.top_client': 'Лучший клиент',
    'analytics.top_n_clients': 'Топ {n} клиентов',
    'analytics.daily_stats': 'Дневная статистика',
    'analytics.date_col': 'Дата',
    'analytics.status_dist': 'Распределение по статусам',

    // orders page
    'orders_page.total': 'Всего заказов',
    'orders_page.delivered_count': 'Доставлено',
    'orders_page.pending_count': 'Ожидание',
    'orders_page.revenue': 'Выручка',

    // tv mode
    'tv.title': 'TV режим',
    'tv.description': 'Отображение на полный экран',
    'tv.start_btn': 'Запустить',
    'tv.exit_hint': 'Нажмите ESC для выхода',
    'tv.marathon_slide': 'Марафон',
    'tv.kpi_slide': 'KPI',
    'tv.analytics_slide': 'Аналитика',
    'tv.clients_slide': 'Клиенты',

    // general
    'general.loading': 'Загрузка...',
    'general.error': 'Произошла ошибка',
    'general.retry': 'Повторить',
    'general.som': 'сум',
    'general.orders_unit': 'шт',
    'general.no_data': 'Нет данных',
    'general.agents_unit': 'агент',

    // alerts
    'alerts.backend_error': 'Ошибка подключения к серверу',
    'alerts.sales_drop_20': 'Продажи упали на 20%!',

    // data management
    'data.title': 'Управление данными',
  },
}
