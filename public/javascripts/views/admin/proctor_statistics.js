//
// Users view
//
define([
    "i18n",
    "text!templates/admin/proctor_statistics.html",
    "views/user/viewer",
    "views/user/editor"
], function(i18n, template, UserViewer, UserEditor) {
    console.log('views/admin/proctor_statistics.js');
    var View = Backbone.View.extend({
        events: {
            "click .user-info": "doUserInfo"
        },
        initialize: function() {
            // Templates
            this.templates = _.parseTemplate(template);
            // Sub views
            this.view = {
                userViewer: new UserViewer(),
                userEditor: new UserEditor()
            };
        },
        destroy: function() {
            for (var v in this.view) {
                if (this.view[v]) this.view[v].destroy();
            }
            this.remove();
        },
        render: function() {
            var self = this;
            var tpl = _.template(this.templates['main-tpl']);
            var data = {
                i18n: i18n
            };
            this.$el.html(tpl(data));
            $.parser.parse(this.$el);
            
            this.$FromDate = this.$(".date-from");
            this.$FromDate.datebox({
                value: app.now().format("DD.MM.YYYY"),
                delay: 0,
                onChange: function(date) {
                    var valid = moment(date, "DD.MM.YYYY", true).isValid();
                    if (!date || valid) self.doSearch();
                }
            });
            this.$ToDate = this.$(".date-to");
            this.$ToDate.datebox({
                value: app.now().add(1, 'days').format("DD.MM.YYYY"),
                delay: 0,
                onChange: function(date) {
                    var valid = moment(date, "DD.MM.YYYY", true).isValid();
                    if (!date || valid) self.doSearch();
                }
            });

            this.$TextSearch = this.$(".text-search");
            this.$TextSearch.searchbox({
                searcher: this.doSearch.bind(this)
            });

            this.$Grid = this.$("#users-grid");
            this.$Grid.datagrid({
                columns: [
                    [{
                        field: 'username',
                        title: i18n.t('admin.users.username'),
                        width: 100,
                        sortable: true
                    }, {
                        field: 'provider',
                        title: i18n.t('admin.users.provider'),
                        width: 100,
                        sortable: true
                    }, {
                        field: 'fullname',
                        title: i18n.t('admin.users.fullname'),
                        width: 200,
                        sortable: true,
                        sorter: function(a, b) {
                            if (!a || !b) return 0;
                            var fa = a.lastname + ' ' + a.firstname + ' ' + a.middlename;
                            var fb = b.lastname + ' ' + b.firstname + ' ' + b.middlename;
                            return fa.localeCompare(fb);
                        },
                        formatter: self.formatName.bind(this)
                    }, {
                        field: 'role',
                        title: i18n.t('admin.users.role'),
                        width: 100,
                        sortable: true,
                        formatter: self.formatRole.bind(this)
                    }, {
                        field: 'created',
                        title: i18n.t('admin.users.created'),
                        width: 100,
                        sortable: true,
                        formatter: self.formatDate.bind(this)
                    }, {
                        field: 'active',
                        title: i18n.t('admin.users.activeTitle'),
                        width: 100,
                        sortable: true,
                        formatter: self.formatActive.bind(this)
                    }]
                ],
                remoteSort: false,
                pagination: true,
                pageNumber: 1,
                pageSize: 50,
                pageList: [10, 50, 100, 250, 500, 1000, 10000],
                rownumbers: true,
                ctrlSelect: true,
                url: 'admin/proctor_statistics',
                method: 'get',
                queryParams: {
                    left_date: app.now().startOf('day').toJSON(),
                    right_date: app.now().startOf('day').add(1, 'days').toJSON(),
                    //proctor_id: "5738fc8045a3a2880bb059fa",
                },
                loadFilter: function(data) {
                    console.log(data);
                    data = data || [];
                    var text = self.$TextSearch.textbox('getValue').trim();
                    if (_.isEmpty(text)) return data;
                    else {
                        var rows = _.textSearch(data.rows, text);
                        return {
                            rows: rows,
                            total: rows.length
                        };
                    }
                }
            });

            return this;
        },
        formatName: function(val, row) {
            if (!row) return;
            var data = {
                i18n: i18n,
                row: row
            };
            var tpl = _.template(this.templates['user-item-tpl']);
            return tpl(data);
        },
        formatDate: function(val, row) {
            if (!val) return;
            return moment(val).format('DD.MM.YYYY');
        },
        formatActive: function(val, row) {
            switch (val) {
                case true:
                    return "<span style='color:green;'>" + i18n.t('user.active.true') + "</span>";
                case false:
                    return "<span style='color:purple;'>" + i18n.t('user.active.false') + "</span>";
            }
        },
        formatRole: function(val, row) {
            switch (val) {
                case 1:
                    return i18n.t('user.role.1');
                case 2:
                    return i18n.t('user.role.2');
                case 3:
                    return i18n.t('user.role.3');
            }
            return val;
        },
        getDates: function() {
            var fromVal = this.$FromDate.datebox('getValue');
            var toVal = this.$ToDate.datebox('getValue');
            var fromDate = fromVal ? moment(fromVal, 'DD.MM.YYYY').toJSON() : null;
            var toDate = toVal ? moment(toVal, 'DD.MM.YYYY').toJSON() : null;
            return {
                from: fromDate,
                to: toDate
            };
        },
        doSearch: function() {
            var dates = this.getDates();
            this.$Grid.datagrid('load', {
                left_date: dates.from,
                right_date: dates.to
            });
        },
        doUserInfo: function(e) {
            var element = e.currentTarget;
            var userId = $(element).attr('data-id');
            this.view.userViewer.doOpen(userId);
        }
    });
    return View;
});