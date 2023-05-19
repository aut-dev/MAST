<?php

namespace themes\front;

use Ryssbowh\CraftThemes\base\ThemePlugin;
use craft\helpers\StringHelper;
use craft\web\View;
use nystudio107\twigpack\Twigpack;
use superbig\mobiledetect\MobileDetect;
use themes\front\assets\HomePage;
use themes\front\assets\Index;

class Theme extends ThemePlugin
{
    /**
     * Current view port of client
     * 
     * @var string
     */
    protected $viewPort;

    /**
     * @inheritDoc
     */
    protected $assetBundles = [
        '*' => [Index::class],
        '' => [HomePage::class]
    ];

    protected $_manifest;
    protected $_legacymanifest;

    /**
     * inheritDoc
     */
    public function getName(): string
    {
        return 'Front';
    }

    /**
     * inheritDoc
     */
    public function getExtends(): string
    {
        return 'puzzlers-base-theme';
    }

    /**
     * Register assets related to a page
     * 
     * @param string $name
     */
    public function registerWebpackPage(string $name)
    {
        $this->registerWebpackFile($name . '.js');
        $this->registerWebpackFile($name . '.css');
    }

    /**
     * Registers assets related to a page
     * 
     * @param string $name
     * @param array  $options
     */
    public function registerWebpackFile(string $name, array $options = [])
    {
        if (!isset($this->manifest[$name])) {
            return;
        }
        $file = \Craft::getAlias('@web') . $this->manifest[$name];
        if (StringHelper::endsWith($name, '.js')) {
            \Craft::$app->view->registerJsFile($file, $options);
        } elseif (StringHelper::endsWith($name, '.css')) {
            \Craft::$app->view->registerCssFile($file, $options);
        }
    }

    /**
     * Get the current client viewport
     * 
     * @return string
     */
    public function getViewPort(): string
    {
        if (is_null($this->viewPort)) {
            $detect = MobileDetect::$plugin->mobileDetectService;
            $this->viewPort = 'desktop';
            if ($detect->isPhone()) {
                $this->viewPort = 'mobile';
            } else if ($detect->isTablet()) {
                $this->viewPort = 'tablet';
            }
        }
        return $this->viewPort;
    }

    /**
     * Get the webpack manifest
     * 
     * @return array
     */
    protected function getManifest(): array
    {
        if ($this->_manifest !== null) {
            return $this->_manifest;
        }
        $manifest = \Craft::getAlias('@webroot/themes/front-theme/manifest.json');
        $this->_manifest = [];
        if (file_exists($manifest)) {
            $this->_manifest = json_decode(file_get_contents($manifest), true);
        }
        return $this->_manifest;
    }

    /**
     * Get the webpack legacy manifest
     * 
     * @return array
     */
    protected function getLegacyManifest(): array
    {
        if ($this->_legacymanifest !== null) {
            return $this->_legacymanifest;
        }
        $manifest = \Craft::getAlias('@webroot/themes/front-theme/manifest-legacy.json');
        $this->_legacymanifest = [];
        if (file_exists($manifest)) {
            $this->_legacymanifest = json_decode(file_get_contents($manifest), true);
        }
        return $this->_legacymanifest;
    }
}