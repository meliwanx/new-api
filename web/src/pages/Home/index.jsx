/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useContext, useEffect, useState } from 'react';
import {
  Button,
  Typography,
  Input,
  ScrollList,
  ScrollItem,
  Card,
} from '@douyinfe/semi-ui';
import { API, showError, copy, showSuccess } from '../../helpers';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { API_ENDPOINTS } from '../../constants/common.constant';
import { StatusContext } from '../../context/Status';
import { useActualTheme } from '../../context/Theme';
import { marked } from 'marked';
import { useTranslation } from 'react-i18next';
import {
  IconGithubLogo,
  IconPlay,
  IconFile,
  IconCopy,
  IconKeyStroked,
  IconServerStroked,
  IconCurrencyStroked,
  IconLockStroked,
} from '@douyinfe/semi-icons';
import { Link } from 'react-router-dom';
import NoticeModal from '../../components/layout/NoticeModal';
import {
  Moonshot,
  OpenAI,
  XAI,
  Zhipu,
  Volcengine,
  Cohere,
  Claude,
  Gemini,
  Suno,
  Minimax,
  Wenxin,
  Spark,
  Qingyan,
  DeepSeek,
  Qwen,
  Midjourney,
  Grok,
  AzureAI,
  Hunyuan,
  Xinference,
} from '@lobehub/icons';

const { Text, Title, Heading } = Typography;

const Home = () => {
  const { t, i18n } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const actualTheme = useActualTheme();
  const [homePageContentLoaded, setHomePageContentLoaded] = useState(false);
  const [homePageContent, setHomePageContent] = useState('');
  const [noticeVisible, setNoticeVisible] = useState(false);
  const isMobile = useIsMobile();
  const isDemoSiteMode = statusState?.status?.demo_site_enabled || false;
  const docsLink = statusState?.status?.docs_link || '';
  const serverAddress =
    statusState?.status?.server_address || `${window.location.origin}`;
  const endpointItems = API_ENDPOINTS.map((e) => ({ value: e }));
  const [endpointIndex, setEndpointIndex] = useState(0);
  const isChinese = i18n.language.startsWith('zh');

  const displayHomePageContent = async () => {
    setHomePageContent(localStorage.getItem('home_page_content') || '');
    const res = await API.get('/api/home_page_content');
    const { success, message, data } = res.data;
    if (success) {
      let content = data;
      if (!data.startsWith('https://')) {
        content = marked.parse(data);
      }
      setHomePageContent(content);
      localStorage.setItem('home_page_content', content);

      // 如果内容是 URL，则发送主题模式
      if (data.startsWith('https://')) {
        const iframe = document.querySelector('iframe');
        if (iframe) {
          iframe.onload = () => {
            iframe.contentWindow.postMessage({ themeMode: actualTheme }, '*');
            iframe.contentWindow.postMessage({ lang: i18n.language }, '*');
          };
        }
      }
    } else {
      showError(message);
      setHomePageContent('加载首页内容失败...');
    }
    setHomePageContentLoaded(true);
  };

  const handleCopyBaseURL = async () => {
    const ok = await copy(serverAddress);
    if (ok) {
      showSuccess(t('已复制到剪切板'));
    }
  };

  useEffect(() => {
    const checkNoticeAndShow = async () => {
      const lastCloseDate = localStorage.getItem('notice_close_date');
      const today = new Date().toDateString();
      if (lastCloseDate !== today) {
        try {
          const res = await API.get('/api/notice');
          const { success, data } = res.data;
          if (success && data && data.trim() !== '') {
            setNoticeVisible(true);
          }
        } catch (error) {
          console.error('获取公告失败:', error);
        }
      }
    };

    checkNoticeAndShow();
  }, []);

  useEffect(() => {
    displayHomePageContent().then();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setEndpointIndex((prev) => (prev + 1) % endpointItems.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [endpointItems.length]);

  return (
    <div className='w-full overflow-x-hidden'>
      <NoticeModal
        visible={noticeVisible}
        onClose={() => setNoticeVisible(false)}
        isMobile={isMobile}
      />
      {homePageContentLoaded && homePageContent === '' ? (
        <div className='w-full overflow-x-hidden'>
          {/* 单屏式 Hero 布局 */}
          <div className='hero-green-theme w-full min-h-screen relative'>
            {/* 顶部导航 */}
            <div className='w-full px-6 py-4 flex items-center justify-between max-w-7xl mx-auto'>
              <div className='flex items-center gap-3'>
                <img
                  src='/logo.svg'
                  alt='八方 Logo'
                  className='w-10 h-10 rounded-lg'
                />
                <Text size={isMobile ? 'large' : 'x-large'} weight='bold' className='text-semi-color-text-0'>
                  八方
                </Text>
              </div>
              <div className='flex items-center gap-4'>
                <Link to='/login'>
                  <Button type='tertiary' size={isMobile ? 'small' : 'default'}>
                    {t('登录')}
                  </Button>
                </Link>
                <Link to='/register'>
                  <Button
                    theme='solid'
                    type='primary'
                    size={isMobile ? 'small' : 'default'}
                    className='!rounded-2xl'
                  >
                    {t('注册')}
                  </Button>
                </Link>
              </div>
            </div>

            {/* 核心内容区 */}
            <div className='relative z-10 px-6 py-12 md:py-20 lg:py-32 max-w-7xl mx-auto'>
              {/* 主标题 */}
              <div className='text-center mb-8 md:mb-12'>
                <Heading
                  type={isMobile ? 2 : 1}
                  className={`mb-4 md:mb-6 ${isChinese ? 'tracking-wide' : ''}`}
                >
                  {t('八方')}
                </Heading>
                <Heading
                  type={isMobile ? 3 : 2}
                  className='text-semi-color-text-1 mb-6 md:mb-8'
                >
                  <span className='green-shine-text font-bold'>
                    {t('大模型接口网关')}
                  </span>
                </Heading>
                <Text
                  size={isMobile ? 'large' : 'x-large'}
                  type='tertiary'
                  className='max-w-2xl mx-auto leading-relaxed'
                >
                  {t('统一的 AI 模型聚合与分发平台，支持 40+ 大模型供应商，为您提供稳定、高效的 API 网关服务。')}
                </Text>
              </div>

              {/* CTA 按钮组 */}
              <div className='flex flex-col sm:flex-row items-center justify-center gap-4 mb-12 md:mb-16'>
                <Link to='/console' className='w-full sm:w-auto'>
                  <Button
                    theme='solid'
                    type='primary'
                    size={isMobile ? 'large' : 'x-large'}
                    className='green-cta-button !rounded-2xl w-full sm:w-auto px-8'
                    icon={<IconPlay />}
                  >
                    {t('获取密钥')}
                  </Button>
                </Link>
                {docsLink && (
                  <Button
                    size={isMobile ? 'large' : 'x-large'}
                    className='flex items-center !rounded-2xl w-full sm:w-auto px-6'
                    icon={<IconFile />}
                    onClick={() => window.open(docsLink, '_blank')}
                  >
                    {t('文档')}
                  </Button>
                )}
                {isDemoSiteMode && statusState?.status?.version && (
                  <Button
                    size={isMobile ? 'large' : 'x-large'}
                    className='flex items-center !rounded-2xl w-full sm:w-auto px-6'
                    icon={<IconGithubLogo />}
                    onClick={() =>
                      window.open(
                        'https://github.com/QuantumNous/new-api',
                        '_blank',
                      )
                    }
                  >
                    {statusState.status.version}
                  </Button>
                )}
              </div>

              {/* BASE URL 复制 */}
              <div className='flex flex-col items-center justify-center gap-3 mb-16 md:mb-20 max-w-xl mx-auto'>
                <Text type='tertiary' size='small'>
                  {t('将模型基址替换为：')}
                </Text>
                <div className='flex items-center gap-2 w-full'>
                  <Input
                    readonly
                    value={serverAddress}
                    className='flex-1'
                    size='large'
                    suffix={
                      <div className='flex items-center gap-2'>
                        <ScrollList
                          bodyHeight={32}
                          style={{ border: 'unset', boxShadow: 'unset' }}
                        >
                          <ScrollItem
                            mode='wheel'
                            cycled={true}
                            list={endpointItems}
                            selectedIndex={endpointIndex}
                            onSelect={({ index }) => setEndpointIndex(index)}
                          />
                        </ScrollList>
                        <Button
                          type='primary'
                          onClick={handleCopyBaseURL}
                          icon={<IconCopy />}
                          className='!rounded-xl'
                        />
                      </div>
                    }
                  />
                </div>
              </div>

              {/* 特性卡片网格 */}
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-12 md:mb-16'>
                <Card
                  className='feature-card !rounded-2xl !p-6 text-center'
                  bodyStyle={{ padding: '1.5rem' }}
                >
                  <div className='flex justify-center mb-4'>
                    <div className='w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center'>
                      <IconKeyStroked
                        size='extra-large'
                        className='text-green-600 dark:text-green-400'
                      />
                    </div>
                  </div>
                  <Title heading={6} className='mb-2'>
                    {t('统一密钥')}
                  </Title>
                  <Text type='tertiary' size='small'>
                    {t('一套密钥，支持所有大模型，无需分别申请')}
                  </Text>
                </Card>

                <Card
                  className='feature-card !rounded-2xl !p-6 text-center'
                  bodyStyle={{ padding: '1.5rem' }}
                >
                  <div className='flex justify-center mb-4'>
                    <div className='w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center'>
                      <IconServerStroked
                        size='extra-large'
                        className='text-green-600 dark:text-green-400'
                      />
                    </div>
                  </div>
                  <Title heading={6} className='mb-2'>
                    {t('智能路由')}
                  </Title>
                  <Text type='tertiary' size='small'>
                    {t('智能选择最优供应商，确保高可用和低延迟')}
                  </Text>
                </Card>

                <Card
                  className='feature-card !rounded-2xl !p-6 text-center'
                  bodyStyle={{ padding: '1.5rem' }}
                >
                  <div className='flex justify-center mb-4'>
                    <div className='w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center'>
                      <IconCurrencyStroked
                        size='extra-large'
                        className='text-green-600 dark:text-green-400'
                      />
                    </div>
                  </div>
                  <Title heading={6} className='mb-2'>
                    {t('按量计费')}
                  </Title>
                  <Text type='tertiary' size='small'>
                    {t('精准统计用量，透明计费，随时查看消费明细')}
                  </Text>
                </Card>

                <Card
                  className='feature-card !rounded-2xl !p-6 text-center'
                  bodyStyle={{ padding: '1.5rem' }}
                >
                  <div className='flex justify-center mb-4'>
                    <div className='w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center'>
                      <IconLockStroked
                        size='extra-large'
                        className='text-green-600 dark:text-green-400'
                      />
                    </div>
                  </div>
                  <Title heading={6} className='mb-2'>
                    {t('安全可靠')}
                  </Title>
                  <Text type='tertiary' size='small'>
                    {t('企业级安全防护，数据加密传输，合规可靠')}
                  </Text>
                </Card>
              </div>

              {/* 供应商图标展示 */}
              <div className='text-center'>
                <Text
                  type='tertiary'
                  className='text-base md:text-lg mb-6 md:mb-8 block'
                >
                  {t('支持众多的大模型供应商')}
                </Text>
                <div className='flex flex-wrap items-center justify-center gap-3 sm:gap-4 md:gap-6 lg:gap-8'>
                  {[
                    Moonshot,
                    OpenAI,
                    XAI,
                    Zhipu,
                    Volcengine,
                    Cohere,
                    Claude,
                    Gemini,
                    Suno,
                    Minimax,
                    Wenxin,
                    Spark,
                    Qingyan,
                    DeepSeek,
                    Qwen,
                    Midjourney,
                    Grok,
                    AzureAI,
                    Hunyuan,
                    Xinference,
                  ].map((Icon, index) => (
                    <div
                      key={index}
                      className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity'
                    >
                      <Icon size={40} />
                    </div>
                  ))}
                  <div className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity'>
                    <Text className='!text-lg sm:!text-xl md:!text-2xl font-bold text-semi-color-text-2'>
                      30+
                    </Text>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className='overflow-x-hidden w-full'>
          {homePageContent.startsWith('https://') ? (
            <iframe
              src={homePageContent}
              className='w-full h-screen border-none'
            />
          ) : (
            <div
              className='mt-[60px]'
              dangerouslySetInnerHTML={{ __html: homePageContent }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default Home;
