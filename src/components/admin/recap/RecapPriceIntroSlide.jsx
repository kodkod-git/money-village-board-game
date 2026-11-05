import { STOCK_IMAGES, ESTATE_IMAGES } from '../../../constants/gameData'
import styles from './RecapPriceIntroSlide.module.css'

const ICONS = [
  ...['bio', 'semiconductor', 'finance'].map(key => `/badges/stock/${STOCK_IMAGES[key]}.png`),
  ...['gaon', 'chorong', 'dami'].map(key => `/badges/estate/${ESTATE_IMAGES[key]}.png`),
]

export default function RecapPriceIntroSlide() {
  return (
    <div className={styles.slide}>
      <h2 className={styles.title}>흥미로운 결과도 있어요!</h2>
      <p className={styles.body}>게임마다 주식과 부동산 가격이 달랐다는 점인데요!</p>
      <ul className={styles.icons} aria-hidden="true">
        {ICONS.map((src, i) => (
          <li key={src} className={styles.icon} style={{ '--delay': `${300 + i * 120}ms` }}>
            <img src={src} alt="" />
          </li>
        ))}
      </ul>
    </div>
  )
}
