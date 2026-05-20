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

import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Button, Input, Typography } from '@douyinfe/semi-ui';
import { Link } from 'react-router-dom';
import { marked } from 'marked';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Copy as CopyIcon,
  Database,
  Gauge,
  GitBranch,
  Globe2,
  KeyRound,
  Network,
  Server,
  ShieldCheck,
  Terminal,
  Users,
  WalletCards,
  Zap,
} from 'lucide-react';
import { API, copy, showError, showSuccess } from '../../helpers';
import { StatusContext } from '../../context/Status';
import { useActualTheme } from '../../context/Theme';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import NoticeModal from '../../components/layout/NoticeModal';

const { Text, Title } = Typography;

const HOME_PAGE_CONTENT_KEY = 'home_page_content';

const normalizeContent = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
};

const isUrlContent = (value) => /^https?:\/\//i.test(value);

const isLocalAddress = (value) =>
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?/i.test(value || '');

const metrics = [
  { value: '分钟级', label: '开通中转调用' },
  { value: '/v1', label: '兼容标准接口' },
  { value: '按量', label: '余额统一结算' },
  { value: '7x24', label: '线路状态监控' },
];

const features = [
  {
    icon: Terminal,
    title: '即开即用的模型接口',
    desc: '注册后生成访问密钥，把业务里的 Base URL 切到统一地址即可调用。',
  },
  {
    icon: GitBranch,
    title: '稳定线路与自动切换',
    desc: '中转服务持续监测线路状态，请求异常时尽量切换到可用通道。',
  },
  {
    icon: WalletCards,
    title: '充值余额统一消费',
    desc: '按量使用文本、视觉、语音和向量模型，消费明细清晰可查。',
  },
  {
    icon: KeyRound,
    title: '应用级密钥隔离',
    desc: '为不同项目创建独立 Key，单独设置额度、过期时间和使用范围。',
  },
  {
    icon: BarChart3,
    title: '用量和成本透明',
    desc: '实时查看 token、请求数、余额变化和失败原因，方便核算成本。',
  },
  {
    icon: ShieldCheck,
    title: '限额与风控保护',
    desc: '支持额度上限、频率限制和异常调用控制，避免密钥被滥用。',
  },
  {
    icon: Network,
    title: '同一入口调用多类模型',
    desc: 'Chat、Embedding、Vision、Audio 等能力收束到同一个调用入口。',
  },
  {
    icon: Users,
    title: '团队账户共享额度',
    desc: '成员、应用和业务线可以共用账户余额，也可以按项目独立管控。',
  },
];

const models = [
  'GPT-4o',
  'Claude 3.5',
  'Gemini 2.0',
  'DeepSeek',
  'Qwen',
  'Moonshot',
  'Doubao',
  'GLM',
  'Flux',
  'DALL·E',
  'Whisper',
  'Embedding',
];

const servicePlans = [
  {
    title: '轻量接入',
    desc: '适合个人工具、原型项目和低频业务调用。',
    items: ['按量充值', '共享中转线路', '基础用量统计'],
  },
  {
    title: '业务调用',
    desc: '适合已经上线的产品，把模型调用稳定接入生产环境。',
    items: ['多应用密钥', '线路自动切换', '消费与失败追踪'],
  },
  {
    title: '团队协作',
    desc: '适合多项目、多成员共同使用同一套模型中转服务。',
    items: ['额度分配', '成员权限', '异常调用控制'],
  },
];

const trafficBars = [68, 42, 76, 55, 88, 63, 72, 51, 82, 46, 70, 60];

const routeRows = [
  {
    model: 'chat/completions',
    provider: '高速线路',
    status: '可用',
    latency: '118ms',
  },
  {
    model: 'responses',
    provider: '稳定线路',
    status: '备用',
    latency: '142ms',
  },
  {
    model: 'embeddings',
    provider: '低价线路',
    status: '可用',
    latency: '96ms',
  },
];

const workflowSteps = [
  { icon: WalletCards, title: '充值余额', desc: '按业务需要先充值额度' },
  { icon: KeyRound, title: '创建密钥', desc: '给每个应用单独分配 Key' },
  { icon: CopyIcon, title: '复制地址', desc: '把 Base URL 配到客户端' },
  { icon: CheckCircle2, title: '开始调用', desc: '按模型名称直接发起请求' },
];

const Home = () => {
  const { t, i18n } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const actualTheme = useActualTheme();
  const [homePageContentLoaded, setHomePageContentLoaded] = useState(false);
  const [homePageContent, setHomePageContent] = useState('');
  const [noticeVisible, setNoticeVisible] = useState(false);
  const isMobile = useIsMobile();

  const docsLink = statusState?.status?.docs_link || '';
  const configuredServerAddress = statusState?.status?.server_address || '';
  const browserOrigin =
    typeof window !== 'undefined' ? window.location.origin : '';
  const serverAddress =
    configuredServerAddress && !isLocalAddress(configuredServerAddress)
      ? configuredServerAddress
      : browserOrigin || configuredServerAddress;
  const systemName = statusState?.status?.system_name || '八方';
  void systemName;
  const isChinese = (i18n.language || 'zh').startsWith('zh');

  const apiBaseUrl = useMemo(
    () => `${serverAddress || 'https://api.example.com'}/v1`,
    [serverAddress],
  );

  const displayHomePageContent = async () => {
    try {
      const cached = normalizeContent(
        localStorage.getItem(HOME_PAGE_CONTENT_KEY),
      );
      if (cached) {
        setHomePageContent(cached);
      }

      const res = await API.get('/api/home_page_content');
      const { success, message, data } = res.data || {};
      if (!success) {
        if (message) {
          showError(message);
        }
        setHomePageContent('');
        return;
      }

      const rawContent = normalizeContent(data);
      if (!rawContent) {
        setHomePageContent('');
        localStorage.removeItem(HOME_PAGE_CONTENT_KEY);
        return;
      }

      const content = isUrlContent(rawContent)
        ? rawContent
        : String(marked.parse(rawContent));
      setHomePageContent(content);
      localStorage.setItem(HOME_PAGE_CONTENT_KEY, content);
    } catch (error) {
      console.error('加载首页内容失败:', error);
      setHomePageContent('');
      try {
        localStorage.removeItem(HOME_PAGE_CONTENT_KEY);
      } catch {
        // Ignore storage errors; the default landing page is still safe.
      }
    } finally {
      setHomePageContentLoaded(true);
    }
  };

  const handleCopyBaseURL = async () => {
    const ok = await copy(apiBaseUrl);
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
    displayHomePageContent();
  }, []);

  useEffect(() => {
    if (!isUrlContent(homePageContent)) {
      return;
    }
    const iframe = document.querySelector('iframe[data-homepage-frame]');
    if (!iframe) {
      return;
    }
    iframe.onload = () => {
      iframe.contentWindow?.postMessage({ themeMode: actualTheme }, '*');
      iframe.contentWindow?.postMessage({ lang: i18n.language }, '*');
    };
  }, [actualTheme, homePageContent, i18n.language]);

  if (homePageContentLoaded && homePageContent) {
    return (
      <div className='overflow-x-hidden w-full'>
        <NoticeModal
          visible={noticeVisible}
          onClose={() => setNoticeVisible(false)}
          isMobile={isMobile}
        />
        {isUrlContent(homePageContent) ? (
          <iframe
            data-homepage-frame
            src={homePageContent}
            className='w-full h-screen border-none'
            title={t('首页')}
          />
        ) : (
          <div
            className='custom-home-content mt-[60px]'
            dangerouslySetInnerHTML={{ __html: homePageContent }}
          />
        )}
      </div>
    );
  }

  return (
    <main className='saas-home'>
      <NoticeModal
        visible={noticeVisible}
        onClose={() => setNoticeVisible(false)}
        isMobile={isMobile}
      />

      <section className='saas-hero'>
        <div className='saas-hero-grid' />
        <div className='saas-hero-visual' aria-hidden='true'>
          <div className='gateway-map'>
            <div className='gateway-node gateway-node-main'>
              <Terminal size={24} />
              <span>{t('中转服务')}</span>
            </div>
            <div className='gateway-node gateway-node-a'>{t('用户业务')}</div>
            <div className='gateway-node gateway-node-b'>Chat</div>
            <div className='gateway-node gateway-node-c'>Vision</div>
            <div className='gateway-node gateway-node-d'>Embedding</div>
          </div>
          <div className='hero-console'>
            <div className='hero-console-header'>
              <span />
              <span />
              <span />
              <strong>Model Transit Desk</strong>
            </div>
            <div className='hero-console-body'>
              <div className='hero-console-panel hero-console-panel-wide'>
                <div className='panel-title'>
                  <Activity size={16} />
                  <span>Live requests</span>
                </div>
                <div className='traffic-chart'>
                  {trafficBars.map((height, index) => (
                    <i key={index} style={{ height: `${height}%` }} />
                  ))}
                </div>
              </div>
              <div className='hero-console-panel'>
                <div className='panel-title'>
                  <Gauge size={16} />
                  <span>Response</span>
                </div>
                <strong>120ms</strong>
                <small>P95 relay time</small>
              </div>
              <div className='hero-console-panel'>
                <div className='panel-title'>
                  <Zap size={16} />
                  <span>Availability</span>
                </div>
                <strong>99.92%</strong>
                <small>Last 24 hours</small>
              </div>
              <div className='hero-console-panel hero-console-panel-table'>
                <div className='panel-title'>
                  <Server size={16} />
                  <span>Service routing</span>
                </div>
                {routeRows.map((row) => (
                  <div className='route-row' key={row.model}>
                    <span>{row.model}</span>
                    <b>{row.provider}</b>
                    <em>{row.status}</em>
                    <small>{row.latency}</small>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className='saas-hero-content'>
          <div className='saas-eyebrow'>
            <Globe2 size={16} />
            <span>{t('Model Transit Service')}</span>
          </div>
          <Title
            heading={1}
            className={`saas-hero-title ${isChinese ? 'tracking-wide' : ''}`}
          >
            {t('稳定的大模型中转服务')}
          </Title>
          <Text className='saas-hero-copy'>
            {t(
              '一个密钥、一条兼容接口，按量使用主流大模型。我们负责线路、余额、监控和失败切换，你只需要把模型能力接进自己的业务。',
            )}
          </Text>
          <div className='saas-hero-actions'>
            <Link to='/console'>
              <Button
                theme='solid'
                type='primary'
                size='large'
                icon={<ArrowRight size={18} />}
                iconPosition='right'
              >
                {t('立即开通')}
              </Button>
            </Link>
            {docsLink && (
              <Button
                size='large'
                icon={<BookOpen size={18} />}
                onClick={() => window.open(docsLink, '_blank')}
              >
                {t('接入文档')}
              </Button>
            )}
          </div>
          <div className='saas-endpoint'>
            <span>{t('统一中转地址')}</span>
            <Input
              readOnly
              value={apiBaseUrl}
              suffix={
                <Button
                  type='tertiary'
                  icon={<CopyIcon size={16} />}
                  onClick={handleCopyBaseURL}
                  aria-label={t('复制')}
                />
              }
            />
          </div>
        </div>
      </section>

      <section className='saas-metrics'>
        {metrics.map((item) => (
          <div className='metric-item' key={item.label}>
            <strong>{item.value}</strong>
            <span>{t(item.label)}</span>
          </div>
        ))}
      </section>

      <section className='saas-section'>
        <div className='section-heading'>
          <Text className='section-kicker'>{t('Service Capabilities')}</Text>
          <Title heading={2}>{t('你要接的是服务，不是自己维护一套系统')}</Title>
          <Text>
            {t(
              '密钥、余额、接口、用量和线路状态都在控制台完成管理，业务侧保持简单调用。',
            )}
          </Text>
        </div>
        <div className='feature-grid'>
          {features.map((item) => {
            const FeatureIcon = item.icon;
            return (
              <article className='feature-tile' key={item.title}>
                <div className='feature-icon'>
                  <FeatureIcon size={22} />
                </div>
                <h3>{t(item.title)}</h3>
                <p>{t(item.desc)}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className='saas-section service-plan-section'>
        <div className='section-heading'>
          <Text className='section-kicker'>{t('Usage Scenarios')}</Text>
          <Title heading={2}>{t('从个人工具到生产业务，都按调用量使用')}</Title>
          <Text>
            {t(
              '不用自己维护模型渠道和余额体系，按业务阶段选择合适的调用方式。',
            )}
          </Text>
        </div>
        <div className='service-plan-grid'>
          {servicePlans.map((plan) => (
            <article className='service-plan-card' key={plan.title}>
              <h3>{t(plan.title)}</h3>
              <p>{t(plan.desc)}</p>
              <ul>
                {plan.items.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={16} />
                    <span>{t(item)}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className='workflow-section'>
        <div className='workflow-copy'>
          <Text className='section-kicker'>{t('Quick Start')}</Text>
          <Title heading={2}>{t('从充值到第一次调用，只需要几步')}</Title>
          <Text>
            {t(
              '和接入 OpenAI 兼容接口一样简单：拿到 Key、配置地址、选择模型，然后把请求交给中转服务。',
            )}
          </Text>
        </div>
        <div className='workflow-track'>
          {workflowSteps.map((item, index) => {
            const StepIcon = item.icon;
            return (
              <div className='workflow-step' key={item.title}>
                <div className='workflow-index'>{index + 1}</div>
                <StepIcon size={22} />
                <h3>{t(item.title)}</h3>
                <p>{t(item.desc)}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className='analytics-section'>
        <div className='analytics-panel'>
          <div className='analytics-header'>
            <div>
              <Text className='section-kicker'>{t('Account Visibility')}</Text>
              <Title heading={2}>{t('余额、消费和请求状态随时可查')}</Title>
            </div>
            <div className='health-badge'>
              <span />
              {t('服务正常')}
            </div>
          </div>
          <div className='analytics-grid'>
            <div className='analytics-chart'>
              {trafficBars.concat([74, 58, 92, 66]).map((height, index) => (
                <span key={index} style={{ height: `${height}%` }} />
              ))}
            </div>
            <div className='analytics-list'>
              {[
                ['余额', '¥8,642', '+20%'],
                ['今日消费', '¥128.64', '-11.2%'],
                ['请求数', '246K', '+8.1%'],
                ['自动切换', '37', '-4.8%'],
              ].map(([label, value, trend]) => (
                <div className='analytics-row' key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <em>{trend}</em>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className='saas-section provider-section'>
        <div className='section-heading'>
          <Text className='section-kicker'>{t('Model Access')}</Text>
          <Title heading={2}>{t('常用模型能力都从同一个入口调用')}</Title>
          <Text>
            {t(
              '按场景选择文本、视觉、语音、向量和任务模型，不需要在业务代码里反复更换接入方式。',
            )}
          </Text>
        </div>
        <div className='provider-grid'>
          {models.map((model) => (
            <div className='provider-tile' key={model}>
              <Database size={18} />
              <span>{model}</span>
            </div>
          ))}
        </div>
      </section>

      <section className='final-cta'>
        <div>
          <Text className='section-kicker'>{t('Start Today')}</Text>
          <Title heading={2}>{t('现在开通大模型中转调用')}</Title>
          <Text>
            {t(
              '先创建账号，拿到密钥后把业务里的 Base URL 切到统一中转地址，即可开始按量使用。',
            )}
          </Text>
        </div>
        <Link to='/register'>
          <Button
            theme='solid'
            type='primary'
            size='large'
            icon={<ArrowRight size={18} />}
            iconPosition='right'
          >
            {t('创建账号')}
          </Button>
        </Link>
      </section>
    </main>
  );
};

export default Home;
