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
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Code2,
  Copy as CopyIcon,
  MessageSquareQuote,
  Shield,
  Sparkles,
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

const heroCards = [
  {
    icon: Shield,
    title: '稳定中转',
    desc: '统一管理模型线路、密钥和余额，让业务调用保持稳定。',
  },
  {
    icon: Zap,
    title: '快速接入',
    desc: '兼容常用 API 格式，替换 Base URL 后即可开始调用。',
  },
  {
    icon: Code2,
    title: '专业服务',
    desc: '提供接入建议、使用协助和问题排查，适合长期业务使用。',
  },
];

const trustMetrics = [
  { value: '多模型', label: '主流模型接入' },
  { value: '99.9%', label: '服务稳定目标' },
  { value: '分钟级', label: '完成接入配置' },
  { value: '1v1', label: '专属服务支持' },
];

const subscriptionPlans = [
  {
    name: 'Starter Plan',
    audience: '个人测试与轻量应用',
    price: '¥50',
    period: '起充',
    items: ['按量余额消费', '共享中转线路', '兼容 /v1 接口'],
  },
  {
    name: 'Standard Plan',
    audience: '日常开发与小型产品',
    price: '¥399',
    period: '/月',
    items: ['更高并发额度', '用量明细统计', '模型调用建议'],
  },
  {
    name: 'Premium Plan',
    audience: '生产业务与团队使用',
    price: '¥899',
    period: '/月',
    recommended: true,
    items: ['线路优先保障', '多项目密钥管理', '异常请求协助排查'],
  },
  {
    name: 'Professional Plan',
    audience: '高频调用与企业项目',
    price: '定制',
    period: '',
    items: ['专属接入方案', '团队额度管理', '合同与结算支持'],
  },
];

const flexibleAmounts = [
  { pay: '¥50', get: '$50' },
  { pay: '¥100', get: '$100' },
  { pay: '¥500', get: '$500' },
];

const testimonials = [
  {
    quote: '把多个模型能力收敛到同一个中转地址后，业务侧配置简单很多。',
    name: '产品负责人',
    role: 'SaaS 团队',
    avatar:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop&crop=face',
  },
  {
    quote: '按量余额和密钥隔离适合多项目使用，成本也更容易对账。',
    name: '后端工程师',
    role: '独立开发者',
    avatar:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop&crop=face',
  },
  {
    quote: '我们重点需要稳定的模型中转和问题响应，这个服务很符合团队协作场景。',
    name: '技术负责人',
    role: '企业研发团队',
    avatar:
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&h=120&fit=crop&crop=face',
  },
  {
    quote: '统一入口让客户端和服务端都能复用同一套调用方式，迭代效率更高。',
    name: '全栈开发者',
    role: '工具产品团队',
    avatar:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop&crop=face',
  },
];

const faqs = [
  {
    question: '八方是什么服务？',
    answer:
      '八方是大模型中转站服务，面向个人、团队和企业提供统一模型调用入口、余额计费、密钥管理和接入支持。',
  },
  {
    question: '接入方式复杂吗？',
    answer:
      '不复杂。创建账号和密钥后，把客户端或服务端里的 Base URL 改成八方提供的中转地址，并按模型名称发起请求即可。',
  },
  {
    question: '如何管理不同项目的调用？',
    answer:
      '可以为不同项目创建独立密钥，并设置额度、过期时间和使用范围，方便隔离风险和核算成本。',
  },
  {
    question: '是否适合生产业务？',
    answer:
      '适合需要稳定模型调用、清晰账单和服务支持的业务场景。高频或团队使用可以选择更高等级服务方案。',
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
              <span>{t('我们把模型接入、额度计费、密钥管理')}</span>
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
            <div className='aigo-endpoint-card'>
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

      <section id='pricing' className='aigo-section aigo-pricing'>
        <div className='aigo-section-heading'>
          <Title heading={2}>{t('选择适合您的方案')}</Title>
          <Text>
            {t(
              '按量使用主流大模型能力，所有方案都包含账号安全、用量记录和基础服务支持。',
            )}
          </Text>
        </div>
        <div className='aigo-plan-kicker'>
          <WalletCards size={20} />
          <span>{t('套餐订阅')}</span>
        </div>
        <div className='aigo-plan-grid'>
          {subscriptionPlans.map((plan) => (
            <article
              className={`aigo-plan-card ${plan.recommended ? 'is-recommended' : ''}`}
              key={plan.name}
            >
              {plan.recommended && (
                <div className='aigo-recommended'>{t('推荐选择')}</div>
              )}
              <div className='aigo-plan-head'>
                <h3>{plan.name}</h3>
                <p>{t(plan.audience)}</p>
              </div>
              <div className='aigo-price'>
                <strong>{plan.price}</strong>
                {plan.period && <span>{plan.period}</span>}
              </div>
              <ul>
                {plan.items.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={18} />
                    <span>{t(item)}</span>
                  </li>
                ))}
              </ul>
              <Link to='/login'>
                <Button theme='solid' type='primary' block>
                  {t('登录订阅')}
                </Button>
              </Link>
            </article>
          ))}
        </div>

        <div className='aigo-flexible'>
          <div>
            <Text className='aigo-pill-label'>{t('灵活额度')}</Text>
            <Title heading={3}>{t('按量扣费，额度长期有效')}</Title>
            <p>
              {t(
                '适合测试、临时扩容和多模型混合调用。充值后即可在控制台创建密钥并按调用量消费。',
              )}
            </p>
          </div>
          <div className='aigo-credit-box'>
            {flexibleAmounts.map((item) => (
              <div className='aigo-credit-row' key={item.pay}>
                <span>
                  {t('支付')}
                  <strong>{item.pay}</strong>
                </span>
                <ArrowRight size={18} />
                <span>
                  {t('获得')}
                  <strong>{item.get}</strong>
                </span>
              </div>
            ))}
            <Link to='/console/topup'>
              <Button theme='solid' type='primary' block>
                {t('立即购买')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section id='reviews' className='aigo-section aigo-reviews'>
        <div className='aigo-section-heading'>
          <Text className='aigo-pill-label'>{t('用户评价')}</Text>
          <Title heading={2}>{t('用户怎么说')}</Title>
          <Text>
            {t(
              '从个人项目到团队产品，八方为不同业务提供统一、稳定、可管理的大模型中转服务。',
            )}
          </Text>
        </div>
        <div className='aigo-testimonial-grid'>
          {testimonials.concat(testimonials).map((item, index) => (
            <article className='aigo-testimonial' key={`${item.name}-${index}`}>
              <MessageSquareQuote size={22} />
              <p>{t(item.quote)}</p>
              <div>
                <img src={item.avatar} alt={item.name} />
                <span>
                  <strong>{t(item.name)}</strong>
                  <em>{t(item.role)}</em>
                </span>
              </div>
            </article>
          ))}
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
            <small>{t('模型接入、余额计费、密钥管理与服务支持')}</small>
          </div>
          <div>
            <h3>{t('产品')}</h3>
            <a href='#pricing'>{t('定价')}</a>
            <a href={docsLink || '/console'}>{t('文档')}</a>
            <a href='#faq'>{t('常见问题')}</a>
          </div>
          <div>
            <h3>{t('服务')}</h3>
            <Link to='/console'>{t('控制台')}</Link>
            <Link to='/pricing'>{t('模型广场')}</Link>
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
