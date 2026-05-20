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
import { Button, Typography } from '@douyinfe/semi-ui';
import { Link } from 'react-router-dom';
import { marked } from 'marked';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  Code2,
  Gauge,
  GitBranch,
  KeyRound,
  Layers3,
  LockKeyhole,
  Network,
  Route,
  ServerCog,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react';
import { API, showError } from '../../helpers';
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

const heroCards = [
  {
    icon: Shield,
    title: '模型中转服务',
    desc: '把不同模型能力收敛到一个可管理的调用入口，降低业务接入复杂度。',
  },
  {
    icon: Zap,
    title: '兼容常用接口',
    desc: '按开发者熟悉的请求格式接入，减少客户端与服务端改造成本。',
  },
  {
    icon: ServerCog,
    title: '运维支持',
    desc: '提供线路配置、调用问题排查和使用建议，适合长期业务接入。',
  },
];

const trustMetrics = [
  { value: '多模型', label: '主流模型接入' },
  { value: '兼容', label: '常用 API 格式' },
  { value: '可控', label: '密钥与用量管理' },
  { value: '支持', label: '接入与问题排查' },
];

const capabilityCards = [
  {
    icon: Network,
    title: '模型路由与接入',
    desc: '将不同模型供应方的调用方式收敛到平台侧，业务只需要维护自己的模型调用逻辑。',
    points: ['减少多供应方配置', '按模型能力选择调用', '适配常见客户端'],
  },
  {
    icon: KeyRound,
    title: '密钥与项目隔离',
    desc: '为不同应用、成员或环境创建独立密钥，便于控制风险、拆分项目和定位问题。',
    points: ['独立密钥管理', '项目级隔离', '调用记录可追踪'],
  },
  {
    icon: Gauge,
    title: '用量与成本可见',
    desc: '提供调用记录、余额消耗和模型使用情况，帮助团队更清楚地看见实际消耗。',
    points: ['调用明细查看', '异常消耗排查', '团队对账更清楚'],
  },
  {
    icon: LockKeyhole,
    title: '稳定与安全控制',
    desc: '围绕生产调用需要，提供账号安全、访问控制和服务侧排查能力。',
    points: ['账号安全机制', '权限与访问控制', '服务侧协助定位'],
  },
];

const workflowSteps = [
  {
    label: '01',
    title: '创建账号与项目',
    desc: '进入控制台后为你的应用创建独立项目，把测试、生产或不同业务拆开管理。',
  },
  {
    label: '02',
    title: '生成调用密钥',
    desc: '为服务端、脚本或团队成员生成独立密钥，必要时可以单独停用或轮换。',
  },
  {
    label: '03',
    title: '调整客户端配置',
    desc: '在现有代码里替换模型调用配置，并按目标模型名称发起请求。',
  },
  {
    label: '04',
    title: '查看调用与消耗',
    desc: '上线后在控制台查看请求记录、消耗情况和异常调用，方便持续优化。',
  },
];

const useCases = [
  {
    icon: Code2,
    title: 'AI 应用后端',
    desc: '聊天、写作、搜索、客服、数据分析等产品，可以通过平台接入多个模型能力。',
  },
  {
    icon: GitBranch,
    title: '团队研发环境',
    desc: '为测试、预发、生产环境拆分密钥，让不同环境的调用记录和消耗更清晰。',
  },
  {
    icon: Layers3,
    title: '多模型能力整合',
    desc: '同一业务中需要不同模型能力时，可以减少重复接入、重复维护和重复排查。',
  },
  {
    icon: Route,
    title: '自动化与内部工具',
    desc: '脚本、工作流、内部管理工具可以用更简单的方式接入大模型调用能力。',
  },
];

const operationRows = [
  ['接入复杂度', '业务侧只维护一种主要调用方式，供应方差异由平台侧处理。'],
  ['调用管理', '密钥、项目、记录和消耗集中到控制台，便于团队协作。'],
  ['问题定位', '从请求记录、模型选择、密钥状态等维度排查失败原因。'],
  ['长期维护', '新增模型或调整线路时，减少业务代码反复改造。'],
];

const faqs = [
  {
    question: '八方是什么服务？',
    answer:
      '八方是大模型中转站服务，面向个人开发者、团队和企业提供模型调用接入、密钥管理、用量记录和服务支持。',
  },
  {
    question: '接入方式复杂吗？',
    answer:
      '不复杂。创建账号和密钥后，在现有客户端或服务端里调整模型调用配置，并按目标模型名称发起请求即可。',
  },
  {
    question: '余额消耗怎么理解？',
    answer:
      '不同模型、不同能力和不同计费规则会对应不同消耗比例，实际以控制台展示和平台说明为准，不按固定的人民币兑美元比例计算。',
  },
  {
    question: '是否适合生产业务？',
    answer:
      '适合需要稳定模型调用、清晰用量记录和接入支持的业务场景。生产接入前建议先完成小流量测试和异常处理配置。',
  },
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
  const systemName = statusState?.status?.system_name || '八方';
  void systemName;
  const isChinese = (i18n.language || 'zh').startsWith('zh');

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
    <main className='saas-home aigocode-home'>
      <NoticeModal
        visible={noticeVisible}
        onClose={() => setNoticeVisible(false)}
        isMobile={isMobile}
      />

      <section className='aigo-hero'>
        <div className='aigo-hero-pattern' aria-hidden='true' />
        <div className='aigo-hero-inner'>
          <div className='aigo-hero-copy'>
            <div className='aigo-brand-mark'>
              <span>八方</span>
              <b>&gt;_</b>
            </div>
            <Title
              heading={1}
              className={`aigo-hero-title ${isChinese ? 'tracking-wide' : ''}`}
            >
              {t('重构您的')}
              <span className='aigo-mobile-title-tail'>
                {t('大模型中转体验')}
              </span>
            </Title>
            <Text className='aigo-hero-text'>
              <span>{t('我们把模型接入、密钥管理、用量记录')}</span>
              <span>{t('与服务支持整合到一个中转平台，')}</span>
              <span>{t('帮助你专注自己的产品，')}</span>
              <span>{t('而不是反复维护不同模型渠道。')}</span>
            </Text>
            <div className='aigo-hero-actions'>
              <Link to='/login'>
                <Button
                  theme='solid'
                  type='primary'
                  size='large'
                  icon={<Zap size={18} />}
                  iconPosition='left'
                >
                  {t('立即体验')}
                </Button>
              </Link>
              {docsLink && (
                <Button
                  size='large'
                  icon={<BookOpen size={18} />}
                  onClick={() => window.open(docsLink, '_blank')}
                >
                  {t('查看文档')}
                </Button>
              )}
            </div>
          </div>

          <div className='aigo-hero-cards'>
            {heroCards.map((item) => {
              const HeroIcon = item.icon;
              return (
                <article className='aigo-hero-card' key={item.title}>
                  <HeroIcon size={22} />
                  <div>
                    <h3>{t(item.title)}</h3>
                    <p>{t(item.desc)}</p>
                  </div>
                </article>
              );
            })}
          </div>

          <div className='aigo-trust'>
            <p>{t('面向个人开发者、团队和企业的共同选择')}</p>
            <div>
              {trustMetrics.map((item) => (
                <span key={item.label}>
                  <strong>{item.value}</strong>
                  <em>{t(item.label)}</em>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id='capabilities' className='aigo-section aigo-capabilities'>
        <div className='aigo-section-heading'>
          <Text className='aigo-pill-label'>{t('能力说明')}</Text>
          <Title heading={2}>{t('中转站应该解决的核心问题')}</Title>
          <Text>
            {t(
              '我们不是展示一个开源平台，而是提供能被业务直接使用的大模型中转服务。',
            )}
          </Text>
        </div>
        <div className='aigo-pillar-grid'>
          {capabilityCards.map((item) => {
            const ItemIcon = item.icon;
            return (
              <article className='aigo-pillar-card' key={item.title}>
                <ItemIcon size={24} />
                <h3>{t(item.title)}</h3>
                <p>{t(item.desc)}</p>
                <ul>
                  {item.points.map((point) => (
                    <li key={point}>{t(point)}</li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      <section id='workflow' className='aigo-section aigo-workflow'>
        <div className='aigo-section-heading'>
          <Text className='aigo-pill-label'>{t('接入流程')}</Text>
          <Title heading={2}>{t('从创建密钥到业务上线')}</Title>
          <Text>
            {t(
              '保留你现有的产品逻辑，只把模型调用配置接到八方提供的服务入口。',
            )}
          </Text>
        </div>
        <div className='aigo-workflow-grid'>
          {workflowSteps.map((item) => (
            <article className='aigo-workflow-card' key={item.label}>
              <span>{item.label}</span>
              <h3>{t(item.title)}</h3>
              <p>{t(item.desc)}</p>
            </article>
          ))}
        </div>
        <div className='aigo-intake-panel'>
          <div>
            <Text className='aigo-pill-label'>{t('开发者接入')}</Text>
            <Title heading={3}>{t('把模型调用从业务代码里解耦出来')}</Title>
            <p>
              {t(
                '你可以把八方作为模型调用层，业务系统负责产品逻辑，模型供应、密钥和调用记录交给平台统一管理。',
              )}
            </p>
          </div>
          <pre>
            <code>{`client = createAIClient({
  endpoint: "控制台中的接入入口",
  apiKey: process.env.MODEL_API_KEY
})

response = await client.chat({
  model: "目标模型名称",
  messages: userMessages
})`}</code>
          </pre>
        </div>
      </section>

      <section id='use-cases' className='aigo-section aigo-scenarios'>
        <div className='aigo-section-heading'>
          <Text className='aigo-pill-label'>{t('适用场景')}</Text>
          <Title heading={2}>{t('更适合已经要接入模型的业务')}</Title>
          <Text>
            {t(
              '无论是个人项目还是团队产品，重点都是把模型调用稳定、可查、可维护地接入到业务里。',
            )}
          </Text>
        </div>
        <div className='aigo-scenario-grid'>
          {useCases.map((item) => {
            const ItemIcon = item.icon;
            return (
              <article className='aigo-scenario-card' key={item.title}>
                <ItemIcon size={24} />
                <h3>{t(item.title)}</h3>
                <p>{t(item.desc)}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id='operations' className='aigo-section aigo-operations'>
        <div className='aigo-ops-panel'>
          <div>
            <Text className='aigo-pill-label'>{t('运维保障')}</Text>
            <Title heading={2}>{t('让模型调用更容易维护')}</Title>
            <p>
              {t(
                '中转服务的价值不是堆砌宣传，而是让接入、管理、排查和后续维护都变得更清楚。',
              )}
            </p>
            <Link to='/login'>
              <Button
                theme='solid'
                type='primary'
                size='large'
                icon={<Sparkles size={18} />}
                iconPosition='left'
              >
                {t('进入控制台')}
              </Button>
            </Link>
          </div>
          <div className='aigo-ops-list'>
            {operationRows.map(([label, desc]) => (
              <div className='aigo-ops-row' key={label}>
                <span>{t(label)}</span>
                <p>{t(desc)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id='faq' className='aigo-section aigo-faq'>
        <div className='aigo-section-heading'>
          <Text className='aigo-pill-label'>
            <Sparkles size={16} />
            {t('常见问题')}
          </Text>
          <Title heading={2}>{t('有疑问？我们来解答')}</Title>
        </div>
        <div className='aigo-faq-list'>
          {faqs.map((item, index) => (
            <details
              className='aigo-faq-item'
              key={item.question}
              open={index === 0}
            >
              <summary>
                <span>{t(item.question)}</span>
                <b>+</b>
              </summary>
              <p>{t(item.answer)}</p>
            </details>
          ))}
        </div>
      </section>

      <footer id='contact' className='aigo-footer'>
        <div className='aigo-footer-inner'>
          <div>
            <h2>八方</h2>
            <p>{t('面向业务的大模型中转站服务')}</p>
            <small>{t('模型接入、密钥管理、用量记录与服务支持')}</small>
          </div>
          <div>
            <h3>{t('产品')}</h3>
            <a href='#capabilities'>{t('能力说明')}</a>
            <a href='#workflow'>{t('接入流程')}</a>
            <a href={docsLink || '/console'}>{t('文档')}</a>
            <a href='#faq'>{t('常见问题')}</a>
          </div>
          <div>
            <h3>{t('服务')}</h3>
            <Link to='/console'>{t('控制台')}</Link>
            <a href='#use-cases'>{t('适用场景')}</a>
            <Link to='/about'>{t('联系我们')}</Link>
          </div>
        </div>
        <div className='aigo-footer-bottom'>
          © 2026 八方. All rights reserved.
        </div>
      </footer>
    </main>
  );
};

export default Home;
