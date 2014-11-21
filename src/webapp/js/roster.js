/**
 * Copyright (c) 2008-2010 The Sakai Foundation
 *
 * Licensed under the Educational Community License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *             http://www.osedu.org/licenses/ECL-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific roster.language governing permissions and
 * limitations under the License.
 */

/**
 * Daniel Robinson (d.b.robinson@lancaster.ac.uk)
 * Adrian Fish (a.fish@lancaster.ac.uk)
 */

(function ($) {

    // jquery.i18n
	$.i18n.properties({
	    name:'ui', 
	    path:'/sakai-roster2-tool/i18n/',
	    mode: 'both',
	    language: roster.language
	});
    
	roster.i18n = $.i18n.map;
	
    roster.ADMIN = 'admin';

    roster.STATE_OVERVIEW = 'overview';
    roster.STATE_ENROLLMENT_STATUS = 'status';
    roster.STATE_VIEW_PROFILE = 'profile';
    roster.STATE_PERMISSIONS = 'permissions';

    roster.DEFAULT_GROUP_ID = 'all';
    roster.DEFAULT_ENROLLMENT_STATUS = 'All';
    roster.DEFAULT_STATE = roster.STATE_OVERVIEW;

    /* Stuff that we always expect to be setup */
    roster.language = null;
    roster.currentUserPermissions = null;
    roster.site = null;

    // so we can return to the previous state after viewing permissions
    roster.rosterLastStateNotPermissions = null;

    // These are default behaviours, and are global so the tool remembers
    // the user's choices.
    roster.hideNames = false;
    roster.viewSingleColumn = false;
    roster.groupToView = null;
    roster.groupToViewText = roster.i18n.roster_sections_all;
    roster.enrollmentSetToView = null;
    roster.enrollmentSetToViewText = null;
    roster.enrollmentStatusToViewText = roster.i18n.roster_enrollment_status_all;
    roster.rosterOfficialPictureMode = false;
    roster.nextPage = 0;
    roster.currentState = null;

    /**
     * Renders a handlebars template.
     */
    roster.render = function (template, data, outputId) {

        var t = Handlebars.templates[template];
        document.getElementById(outputId).innerHTML = t(data);
    };

    roster.switchState = function (state, arg, searchQuery) {

        roster.currentState = state;

        $('#roster_navbar > li > span').removeClass('current');
        
        // so we can return to the previous state after viewing permissions
        if (state !== roster.STATE_PERMISSIONS) {
            roster.rosterLastStateNotPermissions = state;
        }
        
        // permissions
        if (roster.siteMaintainer) {
            $('#navbar_permissions_link').show();
        } else {
            $('#navbar_permissions_link').hide();
        }
        
        // enrollment
        if (!roster.currentUserPermissions.viewEnrollmentStatus ||
                roster.site.siteEnrollmentSets.length === 0) {
            
            $('#navbar_enrollment_status_link').hide();
            
            // this can happen if roster.default.state=3
            if (roster.STATE_ENROLLMENT_STATUS === state) {
                state = roster.DEFAULT_STATE;
            }
        }

        if (!roster.currentUserPermissions.rosterExport) {
            $('#navbar_export_link').hide();
        }
            
        if (roster.STATE_OVERVIEW === state) {

            roster.enrollmentSetToView = null;
            roster.groupToView = null;

            $('#navbar_overview_link > span').addClass('current');

            $('#roster_header').html('');
            $('#roster_section_filter').html('');
            $('#roster_search').html('');

            var showOfficialPictures = false;

            if ((arg && arg.forceOfficialPicture) || roster.rosterOfficialPictureMode) {
                showOfficialPictures = true;
            }

            roster.render('overview',
                { siteGroups: roster.site.siteGroups,
                    membersTotal: roster.i18n.currently_displaying_participants.replace(/\{0\}/, roster.site.membersTotal),
                    roleFragments: roster.getRoleFragments(),
                    roles: roster.site.userRoles,
                    viewOfficialPhoto: roster.currentUserPermissions.viewOfficialPhoto },
                'roster_content');

            $(document).ready(function () {

                $('#roster-groups-selector-top').change(function (e) {

                    if (this.value === 'all') {
                        roster.groupToView = null;
                        roster.renderMembership({ forceOfficialPicture: showOfficialPictures, replace: true });
                    } else {
                        roster.renderGroupMembership(this.value, showOfficialPictures);
                    }
                });

                $('#roster-roles-selector').change(function (e) {

                    if (this.value === 'all') {
                        roster.groupToView = null;
                        roster.renderMembership({ forceOfficialPicture: showOfficialPictures, replace: true });
                    } else {
                        roster.roleToView = this.value;
                        roster.renderMembership({ forceOfficialPicture: showOfficialPictures, replace: true });
                    }
                });

                if (roster.currentUserPermissions.viewOfficialPhoto) {

                    $('#roster_official_picture_button').click(function (e) {

                        roster.rosterOfficialPictureMode = true;
                        roster.renderMembership({ forceOfficialPicture: true, replace: true });
                    });
        
                    $('#roster_profile_picture_button').click(function (e) {

                        roster.rosterOfficialPictureMode = false;
                        roster.renderMembership({ forceOfficialPicture: false, replace: true });
                    });
                }

                roster.readySearchButton();
                roster.readySearchField();
                roster.readyClearButton(state);

                roster.renderMembership({ forceOfficialPicture: showOfficialPictures, replace: false });
            });

            $(window).off('scroll.roster').on('scroll.roster', function (e) {

                roster.scrollFunction(showOfficialPictures);
            });
        } else if (roster.STATE_VIEW_PROFILE === state) {
            
            roster.sakai.getProfileMarkup(arg.userId, function (profileMarkup) {
            
                $('#roster_content').html(profileMarkup);
                
                if(window.frameElement) {
                    setMainFrameHeight(window.frameElement.id);
                }
            });
            
        } else if (roster.STATE_ENROLLMENT_STATUS === state) {

            roster.nextPage = 0;
            roster.groupToView = null;

            $('#navbar_enrollment_status_link > span').addClass('current');
            
            if (null === roster.enrollmentSetToView && null != roster.site.siteEnrollmentSets[0]) {
                roster.enrollmentSetToView = roster.site.siteEnrollmentSets[0].id;
                roster.groupToView = null;
            }

            var showOfficialPictures = false;

            if ((arg && arg.forceOfficialPicture) || roster.rosterOfficialPictureMode) {
                showOfficialPictures = true;
            }

            roster.render('enrollment_overview',
                { enrollmentSets: roster.site.siteEnrollmentSets,
                    onlyOne: roster.site.siteEnrollmentSets.length == 1,
                    enrollmentStatusCodes: roster.site.enrollmentStatusCodes,
                    viewOfficialPhoto: roster.currentUserPermissions.viewOfficialPhoto },
                'roster_content');

            $(document).ready(function () {

                $('#roster-enrollmentset-selector').change(function (e) {

                    var option = this.options[this.selectedIndex];
                    roster.enrollmentSetToView = option.value;
                    roster.enrollmentSetToViewText = option.text;
                    roster.renderMembership({ forceOfficialPicture: showOfficialPictures, replace: true });
                });

                $('#roster-status-selector').change(function (e) {

                    roster.renderMembership({ forceOfficialPicture: showOfficialPictures, replace: true, enrollmentStatus: this.value });
                });

                if (roster.currentUserPermissions.viewOfficialPhoto) {

                    $('#roster_official_picture_button').click(function (e) {

                        roster.rosterOfficialPictureMode = true;
                        roster.renderMembership({ forceOfficialPicture: true, replace: true });
                    });
        
                    $('#roster_profile_picture_button').click(function (e) {

                        roster.rosterOfficialPictureMode = false;
                        roster.renderMembership({ forceOfficialPicture: false, replace: true });
                    });
                }

                roster.readySearchButton();
                roster.readySearchField();
                roster.readyClearButton(state);

                roster.renderMembership({ forceOfficialPicture: showOfficialPictures, replace: true });
            });
        } else if (roster.STATE_PERMISSIONS === state) {

            $('#navbar_permissions_link > span').addClass('current');
            
            roster.render('permissions_header',
                    { 'siteTitle': roster.site.title }, 'roster_header');
            
            $('#roster_section_filter').html('');
            $('#roster_search').html('');

            roster.sakai.getSitePermissionMatrix(roster.siteId, function (permissions) {

                roster.site.permissions = permissions;

                var roles = Object.keys(permissions).map(function (role) {
                        return {name: role};
                    });
            
                roster.render('permissions', { roles: roles }, 'roster_content');
                
                $(document).ready(function () {

                    $('#roster_permissions_save_button').click(function () {

                       roster.sakai.savePermissions(roster.siteId, 'roster_permission_checkbox',
                               function () { roster.switchState(roster.rosterLastStateNotPermissions); } );
                    });
                    
                    $('#roster_cancel_button').click(function () { roster.switchState(roster.rosterLastStateNotPermissions); } );
                });
            });
        }
    };

    roster.renderGroupMembership = function (groupId, showOfficialPictures) {

        if (groupId === roster.DEFAULT_GROUP_ID) {
            groupId = null;
        } else {
            $('#roster-members').empty();
        }

        $('#roster-search-field').val('');

        roster.groupToView = groupId;

        roster.renderMembership({ forceOfficialPicture: showOfficialPictures, replace: true });
    };

    roster.renderMembership = function (options) {

        var enrollmentsMode = (roster.enrollmentSetToView) ? true : false;

        if (options.replace) {
            $('#roster-members').empty();
            roster.nextPage = 0;

            $(window).off('scroll.roster').on('scroll.roster', function (e) {

                roster.scrollFunction(options.forceOfficialPicture, options.enrollmentStatus);
            });
        }

        var url = "/direct/roster-membership/" + roster.siteId;
        
        if (options.userId) {
            url += "/get-user.json?userId=" + options.userId;
            if (roster.enrollmentSetToView) {
                url += "&enrollmentSetId=" + roster.enrollmentSetToView;
            }
        } else {
            url += "/get-membership.json?page=" + roster.nextPage;
            if (roster.groupToView) {
                url += "&groupId=" + roster.groupToView;
            } else if (roster.enrollmentSetToView) {
                url += "&enrollmentSetId=" + roster.enrollmentSetToView;
            } else if (roster.roleToView) {
                url += "&roleId=" + roster.roleToView;
            }
        }

        if (options.enrollmentStatus) {
            url += '&enrollmentStatus=' + options.enrollmentStatus;
        }

        var loadImage = $('#roster-loading-image')
        loadImage.show();

        $.ajax({
            url: url,
            dataType: "json",
            cache: false,
            success: function (data) {

                if (data.status && data.status === 'END') {
                    $(window).off('scroll.roster');
                    loadImage.hide();
                    return;
                }

                var members = data['roster-membership_collection'];

                members.forEach(function (m) {

                    m.formattedProfileUrl = "/direct/profile/" + m.userId + "/formatted?siteId=" + roster.siteId;
                    m.profileImageUrl = "/direct/profile/" + m.userId + "/image";
                    if (options.forceOfficialPicture) {
                        m.profileImageUrl += "/official";
                    }
                    m.profileImageUrl += "?siteId=" + roster.siteId;
                    m.hasGroups = Object.keys(m.groups).length > 0;
                    m.enrollmentStatusText = roster.site.enrollmentStatusCodes[m.enrollmentStatusId];
                });

                roster.renderMembers(members, $('#roster-members'), enrollmentsMode);

                $(document).ready(function () {

                    $('.roster-groups-selector').off('change').on('change', function (e) {

                        var value = this.value;

                        roster.renderGroupMembership(this.value, options.forceOfficialPicture);

                        $('#roster-group-option-' + value).prop('selected', true);
                    });
                });

                roster.nextPage += 1;

                loadImage.hide();
            },
            error: function (jqXHR, textStatus, errorThrown) {

                console.log('Failed to get membership data. textStatus: ' + textStatus + '. errorThrown: ' + errorThrown);
            }
        });
    };

    roster.readyClearButton = function (state) {
        
        $('#roster_form_clear_button').click(function (e) {

            roster.switchState(state);
        });
    };

    roster.search = function (query) {

        if (query !== roster.i18n.roster_search_text && query !== "") {
            var userId = roster.searchIndex[query];
            roster.renderMembership({ forceOfficialPicture: false, replace: true, userId: userId });
        }
    };

    roster.readySearchButton = function () {

        $('#roster-search-button').off('click').on('click', function (e) {

            var searchFieldValue = $('#roster-search-field').val();
            roster.search(searchFieldValue);
        });
    };

    roster.readySearchField = function () {

        var field = $('#roster-search-field');

        field.autocomplete({
            source: roster.searchIndexKeys,
            select: function (event, ui) {

                roster.search(ui.item.value);
            }
        });
    };

    roster.renderMembers = function (members, target, enrollmentsMode) {

        var templateData = {
                'roster.language': roster.language,
                'members': members,
                'siteId': roster.siteId,
                'groupToView' :roster.groupToView,
                'firstNameLastName': roster.firstNameLastName,
                'viewEmail': roster.viewEmail,
                'viewUserDisplayId': roster.viewUserDisplayId,
                'viewProfile': roster.currentUserPermissions.viewProfile,
                'viewPicture': true,
                'currentUserId': roster.userId,
                'viewOfficialPhoto': roster.currentUserPermissions.viewOfficialPhoto,
                'viewConnections': (undefined != window.friendStatus)
            };

        var templateName = (enrollmentsMode) ? 'enrollments' : 'members';

        var t = Handlebars.templates[templateName];
        target.append(t(templateData));
    };

    roster.scrollFunction = function (showOfficialPictures, enrollmentStatus) {

        var wintop = $(window).scrollTop(), docheight = $(document).height(), winheight = $(window).height();
 
        if  ((wintop/(docheight-winheight)) > 0.95) {
            if (showOfficialPictures) {
                roster.renderMembership({ forceOfficialPicture: true, replace: false, enrollmentStatus: enrollmentStatus });
            } else {
                roster.renderMembership({ forceOfficialPicture: false, replace: false, enrollmentStatus: enrollmentStatus });
            }
        }
    };

    roster.getRoleFragments = function () {

        return Object.keys(roster.site.roleCounts).map(function (key) {

            var frag = roster.i18n.role_breakdown_fragment.replace(/\{0\}/, roster.site.roleCounts[key]);
            return frag.replace(/\{1\}/, key);
        }).join();
    };

    // Functions and attributes added. All the code from hereon is executed
    // after load.

	if (!roster.siteId) {
		alert('The site id  MUST be supplied as a bootstrap parameter.');
		return;
	}
	
	if (!roster.userId) {
		alert("No current user. Have you logged in?");
		return;
	}

    Handlebars.registerHelper('translate', function (key) {
        return roster.i18n[key];
    });

    Handlebars.registerHelper('getName', function (firstNameLastName) {
        return (firstNameLastName) ? this.displayName : this.sortName;
    });

    Handlebars.registerHelper('isMe', function (myUserId) {
        return this.userId === myUserId;
    });

    Handlebars.registerHelper('profileDiv', function () {
        return 'profile_friend_' + this.userId;
    });

    Handlebars.registerHelper('unconnected', function () {
	    return this.connectionStatus === CONNECTION_NONE;
    });

    Handlebars.registerHelper('confirmed', function () {
	    return this.connectionStatus === CONNECTION_CONFIRMED;
    });

    Handlebars.registerHelper('requested', function () {
	    return this.connectionStatus === CONNECTION_REQUESTED;
    });

    Handlebars.registerHelper('incoming', function () {
	    return this.connectionStatus === CONNECTION_INCOMING;
    });

    Handlebars.registerHelper('roleAllowed', function (options) {

        var perm = options.hash.permission;
        var role = this.name;

        return roster.site.permissions[role].indexOf(perm) != -1;
    });

	
    $.ajax({
        url: "/direct/roster-membership/" + roster.siteId + "/get-site.json",
        dataType: "json",
        async: false,
        cache: false,
        success: function (data) {

            roster.site = data || {};

            if (null == roster.site.siteGroups
                    || typeof roster.site.siteGroups === 'undefined') {
                roster.site.siteGroups = [];
            }
            
            if (null == roster.site.userRoles
                    || typeof roster.site.userRoles === 'undefined') {
                roster.site.userRoles = [];
            }
            
            if (null == roster.site.siteEnrollmentSets
                    || typeof roster.site.siteEnrollmentSets === 'undefined') {
                roster.site.siteEnrollmentSets = [];
            }
        }
    });

    // Setup the current user's permissions
    if (roster.userId === roster.ADMIN) {
        // Admin user. Give the full set.
        var data = ['roster.export',
                'roster.viewallmembers',
                'roster.viewenrollmentstatus',
                'roster.viewgroup',
                'roster.viewhidden',
                'roster.viewprofile',
                'site.upd'];

        roster.currentUserPermissions = new roster.RosterPermissions(data);
    } else {
        roster.currentUserPermissions = new roster.RosterPermissions(
            roster.sakai.getCurrentUserPermissions(roster.siteId));
    }
	
	// We need the toolbar in a template so we can swap in the translations
    roster.render('navbar', {}, 'roster_navbar');
	
	$('#navbar_overview_link > span > a').click(function (e) {
		return roster.switchState(roster.STATE_OVERVIEW);
	});

	$('#navbar_enrollment_status_link > span > a').click(function (e) {
		return roster.switchState(roster.STATE_ENROLLMENT_STATUS);
	});

    $('#navbar_export_link > span > a').click(function (e) {

        e.preventDefault();
        
        var baseUrl = "/direct/roster-export/" + roster.siteId +
            "/export-to-excel?viewType=" + roster.currentState;
        
        var facetParams = "&facetName=" + roster.i18n.facet_name +
            "&facetUserId=" + roster.i18n.facet_userId +
            "&facetEmail=" + roster.i18n.facet_email +
            "&facetRole=" + roster.i18n.facet_role +
            "&facetGroups=" + roster.i18n.facet_groups +
            "&facetStatus=" + roster.i18n.facet_status +
            "&facetCredits=" + roster.i18n.facet_credits;
        
        if (roster.STATE_OVERVIEW === roster.currentState) {
            var groupId = null;
            if (null != roster.groupToView) {
                groupId = roster.groupToView;
            } else {
                groupId = roster.DEFAULT_GROUP_ID;
            }
            
            window.location.href = baseUrl + "&groupId=" + groupId + facetParams;
        } else if (roster.STATE_ENROLLMENT_STATUS === roster.currentState) {
        
            var enrollmentStatus = null;
            if (roster.enrollmentStatusToViewText == roster_enrollment_status_all) {
                enrollmentStatus = roster.DEFAULT_ENROLLMENT_STATUS;
            } else {
                enrollmentStatus = roster.enrollmentStatusToViewText;
            }
            
            window.location.href = baseUrl + 
                "&enrollmentSetId=" + roster.enrollmentSetToView +
                "&enrollmentStatus=" + enrollmentStatus +
                facetParams;
        }
    });
	
    $('#navbar_permissions_link > span > a').click(function (e) {
        return roster.switchState(roster.STATE_PERMISSIONS);
    });
        	
    try {
        if (window.frameElement) {
            window.frameElement.style.minHeight = '600px';
        }
    } catch (err) {}

    $.ajax({
        url: '/direct/roster-membership/' + roster.siteId + '/get-search-index.json',
        dataType: "json",
        success: function (data) {
            roster.searchIndex = data.data;
            roster.searchIndexKeys = Object.keys(data.data);
            // Now switch into the requested state
            roster.switchState(roster.state, roster);
        },
        error: function () {
        }
    });
}) (jQuery);
