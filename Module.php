<?php
/**
 * This code is licensed under AGPLv3 license or AfterLogic Software License
 * if commercial version of the product was purchased.
 * For full statements of the licenses see LICENSE-AFTERLOGIC and LICENSE-AGPL3 files.
 */

namespace Aurora\Modules\FilesWebclient;

/**
 * @license https://www.gnu.org/licenses/agpl-3.0.html AGPL-3.0
 * @license https://afterlogic.com/products/common-licensing AfterLogic Software License
 * @copyright Copyright (c) 2018, Afterlogic Corp.
 *
 * @package Modules
 */
class Module extends \Aurora\System\Module\AbstractWebclientModule
{
	/**
	 *
	 * @var \CApiModuleDecorator
	 */
	protected $oMinModuleDecorator = null;
	
	/**
	 *
	 * @var \CApiModuleDecorator
	 */
	protected $oFilesModuleDecorator = null;

	/**
	 * @var array
	 */
	protected $aRequireModules = ['Files', 'Min'];

	/***** private functions *****/
	/**
	 * Initializes Files Module.
	 * 
	 * @ignore
	 */
	public function init() 
	{
		$this->oFilesModuleDecorator = \Aurora\Modules\Files\Module::Decorator();
		$this->oMinModuleDecorator = \Aurora\Modules\Min\Module::Decorator();

		$this->AddEntry('files-pub', 'EntryPub');
	}

	/***** private functions *****/
	
	/***** public functions *****/
	/**
	 * @ignore
	 */
	public function EntryPub()
	{
		\Aurora\System\Api::checkUserRoleIsAtLeast(\Aurora\System\Enums\UserRole::Anonymous);
		
		$sHash = (string) \Aurora\System\Application::GetPathItemByIndex(1, '');
		$sAction = (string) \Aurora\System\Application::GetPathItemByIndex(2, 'download');
		
		$bDownload = !(!empty($sAction) && $sAction === 'view');
		$bList = (!empty($sAction) && $sAction === 'list');
		
		if ($bList)
		{
			$sResult = '';
			if ($this->oMinModuleDecorator)
			{
				$mData = $this->oMinModuleDecorator->GetMinByHash($sHash);

				if (\is_array($mData) && isset($mData['IsFolder']) && $mData['IsFolder'])
				{
					$oApiIntegrator = \Aurora\Modules\Core\Managers\Integrator::getInstance();

					if ($oApiIntegrator)
					{
						$oCoreClientModule = \Aurora\System\Api::GetModule('CoreWebclient');
						if ($oCoreClientModule instanceof \Aurora\System\Module\AbstractModule) 
						{
							$sResult = \file_get_contents($oCoreClientModule->GetPath().'/templates/Index.html');
							if (\is_string($sResult)) 
							{
								$oSettings =& \Aurora\System\Api::GetSettings();
								$sFrameOptions = $oSettings->GetConf('XFrameOptions', '');
								if (0 < \strlen($sFrameOptions)) 
								{
									@\header('X-Frame-Options: '.$sFrameOptions);
								}
								
								$aConfig = array(
									'public_app' => true,
									'modules_list' => $oApiIntegrator->GetModulesForEntry('FilesWebclient')
								);

								$sResult = \strtr($sResult, array(
									'{{AppVersion}}' => AU_APP_VERSION,
									'{{IntegratorDir}}' => $oApiIntegrator->isRtl() ? 'rtl' : 'ltr',
									'{{IntegratorLinks}}' => $oApiIntegrator->buildHeadersLink(),
									'{{IntegratorBody}}' => $oApiIntegrator->buildBody($aConfig)
								));
							}
						}
					}
				}
				else if ($mData && isset($mData['__hash__'], $mData['Name'], $mData['Size']))
				{
					$sUrl = (bool) $this->getConfig('ServerUseUrlRewrite', false) ? '/download/' : '?/files-pub/';

					$sUrlRewriteBase = (string) $this->getConfig('ServerUrlRewriteBase', '');
					if (!empty($sUrlRewriteBase))
					{
						$sUrlRewriteBase = '<base href="'.$sUrlRewriteBase.'" />';
					}

					$sResult = \file_get_contents($this->GetPath().'/templates/FilesPub.html');
					if (\is_string($sResult))
					{
						$sResult = \strtr($sResult, array(
							'{{Url}}' => $sUrl.$mData['__hash__'], 
							'{{FileName}}' => $mData['Name'],
							'{{FileSize}}' => \Aurora\System\Utils::GetFriendlySize($mData['Size']),
							'{{FileType}}' => \Aurora\System\Utils::GetFileExtension($mData['Name']),
							'{{BaseUrl}}' => $sUrlRewriteBase 
						));
					}
					else
					{
						\Aurora\System\Api::Log('Empty template.', \Aurora\System\Enums\LogLevel::Error);
					}
				}
				else 
				{
					$sResult = \file_get_contents($this->GetPath().'/templates/NotFound.html');
					$sResult = \strtr($sResult, array(
						'{{NotFound}}' => $this->oFilesModuleDecorator->i18N('INFO_NOTFOUND')
					));
				}
			}

			return $sResult;
		}
		else
		{
			if ($this->oMinModuleDecorator)
			{
				$aHash = $this->oMinModuleDecorator->GetMinByHash($sHash);

				if (isset($aHash['__hash__']) && ((isset($aHash['IsFolder']) && (bool) $aHash['IsFolder'] === false) || !isset($aHash['IsFolder'])))
				{
					echo $this->oFilesModuleDecorator->getRawFile(
						null, 
						$aHash['Type'], 
						$aHash['Path'], 
						$aHash['Name'], 
						$sHash, 
						$sAction
					);
				}
				else 
				{
					$sResult = \file_get_contents($this->GetPath().'/templates/NotFound.html');
					$sResult = \strtr($sResult, array(
						'{{NotFound}}' => $this->oFilesModuleDecorator->i18N('INFO_NOTFOUND')
					));

					return $sResult;
				}
			}
		}
	}
	
	public function GetSettings()
	{
		\Aurora\System\Api::checkUserRoleIsAtLeast(\Aurora\System\Enums\UserRole::Anonymous);
		
		$aModuleSettings = array(
			'EditFileNameWithoutExtention' => $this->getConfig('EditFileNameWithoutExtention', false),
			'ShowCommonSettings' => $this->getConfig('ShowCommonSettings', false),
			'ServerUrlRewriteBase' => $this->getConfig('ServerUrlRewriteBase', false),
			'ServerUseUrlRewrite' => $this->getConfig('ServerUseUrlRewrite', false),
			'ShowFilesApps' => $this->getConfig('ShowFilesApps', true)
		);
		
		return $aModuleSettings;
	}
}
