'use strict';

var
	_ = require('underscore'),
	$ = require('jquery'),
	ko = require('knockout'),
	
	FilesUtils = require('%PathToCoreWebclientModule%/js/utils/Files.js'),
	TextUtils = require('%PathToCoreWebclientModule%/js/utils/Text.js'),
	Types = require('%PathToCoreWebclientModule%/js/utils/Types.js'),
	
	UserSettings = require('%PathToCoreWebclientModule%/js/Settings.js'),
	WindowOpener = require('%PathToCoreWebclientModule%/js/WindowOpener.js'),
	
	CAbstractFileModel = require('%PathToCoreWebclientModule%/js/models/CAbstractFileModel.js'),
	CDateModel = require('%PathToCoreWebclientModule%/js/models/CDateModel.js'),
	
	Popups = require('%PathToCoreWebclientModule%/js/Popups.js'),
	EmbedHtmlPopup = require('%PathToCoreWebclientModule%/js/popups/EmbedHtmlPopup.js'),
	
	Ajax = require('modules/%ModuleName%/js/Ajax.js'),
	Settings = require('modules/%ModuleName%/js/Settings.js')
;

/**
 * @constructor
 * @extends CCommonFileModel
 */
function CFileModel()
{
	this.id = ko.observable('');
	this.fileName = ko.observable('');
	this.storageType = ko.observable(Enums.FileStorageType.Personal);
	this.lastModified = ko.observable('');
	
	this.path = ko.observable('');
	this.fullPath = ko.observable('');
	
	this.selected = ko.observable(false);
	this.checked = ko.observable(false);
	
	this.sPublicHash = '';

	this.isExternal = ko.observable(false);
	this.isLink = ko.observable(false);
	this.linkType = ko.observable('');
	this.linkUrl = ko.observable('');
	this.thumbnailExternalLink = ko.observable('');
	this.embedType = ko.observable('');
	this.linkType.subscribe(function (sLinkType) {
		var sEmbedType = '';
		if (sLinkType === 'oembeded')
		{
			sEmbedType = 'oembeded';
		}
		this.hasHtmlEmbed(sEmbedType !== '');
		this.embedType(sEmbedType);
	}, this);
	
	this.deleted = ko.observable(false); // temporary removal until it was confirmation from the server to delete
	this.recivedAnim = ko.observable(false).extend({'autoResetToFalse': 500});
	this.shared = ko.observable(false);
	this.ownerName = ko.observable('');
	
	this.ownerHeaderText = ko.computed(function () {
		return TextUtils.i18n('%MODULENAME%/LABEL_OWNER_EMAIL', {
			'OWNER': this.ownerName()
		});
	}, this);
	
	this.lastModifiedHeaderText = ko.computed(function () {
		return TextUtils.i18n('%MODULENAME%/LABEL_LAST_MODIFIED', {
			'LASTMODIFIED': this.lastModified()
		});
	}, this);
	
	CAbstractFileModel.call(this, Settings.ServerModuleName);
	
	this.type = this.storageType;
	this.uploaded = ko.observable(true);

	this.viewLink = ko.computed(function () {
		return this.isLink() ? this.linkUrl() : FilesUtils.getViewLink(Settings.ServerModuleName, this.hash(), this.sPublicHash);
	}, this);

	this.isViewable = ko.computed(function () {
		
		var 
			bResult = false,
			aViewableArray = [
				'JPEG', 'JPG', 'PNG', 'GIF', 'HTM', 'HTML', 'TXT', 'CSS', 'ASC', 'JS', 'PDF', 'BMP'
			]
		;
		
		if (_.indexOf(aViewableArray, this.extension().toUpperCase()) >= 0)
		{
			bResult = true;
		}

		return (this.iframedView() || bResult || (this.isLink())) && !this.isPopupItem();

	}, this);
	
	this.canShare = ko.computed(function () {
		return (this.storageType() === Enums.FileStorageType.Personal || this.storageType() === Enums.FileStorageType.Corporate);
	}, this);
	
	this.sHtmlEmbed = ko.observable('');
	this.contentType = ko.observable('');
	
	this.sMainAction = 'view';
	
	this.cssClasses = ko.computed(function () {
		var aClasses = this.getCommonClasses();
		
		if (this.allowDrag())
		{
			aClasses.push('dragHandle');
		}
		if (this.selected())
		{
			aClasses.push('selected');
		}
		if (this.checked())
		{
			aClasses.push('checked');
		}
		if (this.deleted())
		{
			aClasses.push('deleted');
		}
		if (this.allowSharing() && this.shared())
		{
			aClasses.push('shared');
		}
		if (this.isLink())
		{
			aClasses.push('aslink');
		}
		
		return aClasses.join(' ');
	}, this);
	
	this.actionsSetter.dispose();
	ko.computed(function () {
		this.setCommonActions();
		
		if ((this.embedType() !== '' || this.linkUrl() === '') && this.isViewable())
		{
			this.leftAction('view');
			this.leftActionText(TextUtils.i18n('COREWEBCLIENT/ACTION_VIEW_FILE'));
		}
		else
		{
			this.leftAction('');
			this.leftActionText('');
		}
		if (this.linkUrl() !== '')
		{
			this.rightAction('open');
			this.rightActionText(TextUtils.i18n('COREWEBCLIENT/ACTION_OPEN_LINK'));
		}
		
		if (this.embedType() !== '')
		{
			this.iconAction('view');
		}
		else
		{
			this.iconAction('');
		}
	}, this);
}

_.extendOwn(CFileModel.prototype, CAbstractFileModel.prototype);

CFileModel.prototype.doRightAction = function ()
{
	this.doCommonRightAction();
	switch (this.rightAction())
	{
		case 'open':
			this.openLink();
			break;
	}
};

CAbstractFileModel.prototype.doIconAction = function ()
{
	switch (this.iconAction())
	{
		case 'view':
			this.viewFile();
			break;
	}
};

/**
 * @param {object} oData
 * @param {string} sLinkUrl
 */
CFileModel.prototype.parseLink = function (oData, sLinkUrl)
{
	this.isPopupItem(true);
	this.linkUrl(sLinkUrl);
	this.fileName(Types.pString(oData.Name));
	this.size(Types.pInt(oData.Size));
	this.linkType(Enums.has('FileStorageLinkType', Types.pString(oData.LinkType)) ? Types.pString(oData.LinkType) : '');
	this.allowDownload(false);
	if (oData.Thumb)
	{
		this.thumb(true);
		this.thumbnailSrc(Types.pString(oData.Thumb));
	}
};

/**
 * @param {object} oData
 * @param {boolean} bPopup
 */
CFileModel.prototype.parse = function (oData, bPopup)
{
	var oDateModel = new CDateModel();
	
	this.allowDrag(true);
	this.allowUpload(true);
	this.allowSharing(true);
	this.allowHeader(true);
	this.allowDownload(true);
	this.isPopupItem(bPopup);
		
	this.isLink(!!oData.IsLink);
	this.fileName(Types.pString(oData.Name));
	this.id(Types.pString(oData.Id));
	this.path(Types.pString(oData.Path));
	this.fullPath(Types.pString(oData.FullPath));
	this.storageType(Types.pString(oData.Type));
	this.shared(!!oData.Shared);
	this.isExternal(!!oData.IsExternal);

	this.iframedView(!!oData.Iframed);
	
	if (this.isLink())
	{
		this.linkUrl(Types.pString(oData.LinkUrl));
		this.linkType(Types.pString(oData.LinkType));
	}
	
	this.size(Types.pInt(oData.Size));
	oDateModel.parse(oData['LastModified']);
	this.lastModified(oDateModel.getShortDate());
	this.ownerName(Types.pString(oData.Owner));
	this.thumb(!!oData.Thumb);
	this.thumbnailExternalLink(Types.pString(oData.ThumbnailLink));
	this.hash(Types.pString(oData.Hash));
	this.sHtmlEmbed(oData.OembedHtml ? oData.OembedHtml : '');
	
	if (this.thumb())
	{
		if (this.thumbnailExternalLink() === '')
		{
			FilesUtils.thumbBase64Queue(this);
		}
		else
		{
			this.thumbnailSrc(this.thumbnailExternalLink());
		}
	}
	
	this.contentType(Types.pString(oData.ContentType));

	if (oData.MainAction)
	{
		this.sMainAction = Types.pString(oData.MainAction);
	}
};

/**
 * Fills attachment data for upload.
 * 
 * @param {string} sFileUid
 * @param {Object} oFileData
 * @param {string} sFileName
 * @param {string} sOwner
 * @param {string} sPath
 * @param {string} sStorageType
 */
CFileModel.prototype.onUploadSelectOwn = function (sFileUid, oFileData, sFileName, sOwner, sPath, sStorageType)
{
	var
		oDateModel = new CDateModel(),
		oDate = new Date()
	;
	
	this.onUploadSelect(sFileUid, oFileData);
	
	oDateModel.parse(oDate.getTime() /1000);
	this.fileName(sFileName);
	this.lastModified(oDateModel.getShortDate());
	this.ownerName(sOwner);
	this.path(sPath);
	this.storageType(sStorageType);
};

/**
 * Fills form with fields for further file downloading or viewing via post to iframe.
 * 
 * @param {object} oForm Jquery object.
 * @param {string} sMethod Method name.
 */
CFileModel.prototype.createFormFields = function (oForm, sMethod)
{
	$('<input type="hidden" name="Module" />').val('Files').appendTo(oForm);
	$('<input type="hidden" name="Method" />').val(sMethod).appendTo(oForm);
	$('<input type="hidden" name="AuthToken" />').val($.cookie('AuthToken')).appendTo(oForm);
	$('<input type="hidden" name="TenantName" />').val(UserSettings.TenantName).appendTo(oForm);
	$('<input type="hidden" name="Parameters" />').val(JSON.stringify({
		'Type': this.type(),
		'Name': encodeURIComponent(this.id()),
		'Path': encodeURIComponent(this.path())
	})).appendTo(oForm);
};

/**
 * Downloads file via post to iframe.
 */
CFileModel.prototype.downloadFile = function ()
{
	if (this.allowDownload())
	{
		var
			sIframeName = 'download_iframe_' + Math.random(),
			oForm = $('<form action="?/Api/" method="post" target="' + sIframeName + '"></form>').hide().appendTo(document.body),
			oIframe = $('<iframe name="' + sIframeName + '"></iframe>').hide().appendTo(document.body)
		;
		this.createFormFields(oForm, 'DownloadFile');
		$('<input type="hidden" name="Format" />').val('Raw').appendTo(oForm);
		oForm.submit();
		setTimeout(function () {
			oForm.remove();
			oIframe.remove();
		}, 200000);
	}
};

/**
 * Opens file viewing via post to iframe.
 */
CFileModel.prototype.viewFile = function (oFileModel, oEvent)
{
	if (!oEvent.ctrlKey && !oEvent.shiftKey)
	{
		if (this.sHtmlEmbed() !== '')
		{
			Popups.showPopup(EmbedHtmlPopup, [this.sHtmlEmbed()]);
		}
		else if (this.isLink())
		{
			this.viewCommonFile(this.linkUrl());
		}
		else
		{
			var oWin = WindowOpener.open('', this.fileName(), true);
			oWin.document.write('<form action="?/Api/" method="post" id="view_form" target="view_iframe" style="display: none;"></form>');
			oWin.document.write('<iframe name="view_iframe" style="width: 100%; height: 100%; border: none;"></iframe>');
			$(oWin.document.body).css({'margin': '0', 'padding': '0'});
			$('<title>' + this.fileName() + '</title>').appendTo($(oWin.document).find('head'));
			var oForm = $(oWin.document).find('#view_form');
			this.createFormFields(oForm, 'ViewFile');
			$('<input type="hidden" name="Format" />').val('Raw').appendTo(oForm);
			$('<input type="submit" />').val('submit').appendTo(oForm);
			oForm.submit();
		}
	}
};

CFileModel.prototype.openLink = function ()
{
	WindowOpener.openTab(this.viewLink());
};

module.exports = CFileModel;
