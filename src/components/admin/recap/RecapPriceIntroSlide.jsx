import { STOCK_IMAGES, ESTATE_IMAGES } from '../../../constants/gameData'
import styles from './RecapPriceIntroSlide.module.css'

const stockIcon = key => `/badges/stock/${STOCK_IMAGES[key]}.png`
const STOCK_ICONS = ['bio', 'semiconductor', 'finance'].map(stockIcon)
// 5판 게임은 뷰티 주식이 추가된다.
const FIVE_BOARD_STOCK_ICONS = [...STOCK_ICONS, stockIcon('beauty')]
const ESTATE_ICONS = ['gaon', 'chorong', 'dami'].map(key => `/badges/estate/${ESTATE_IMAGES[key]}.png`)

// hideRealEstate: 5판 게임은 부동산이 없어 주식 가격만 이야기한다(뷰티 포함 4종목).
export default function RecapPriceIntroSlide({ hideRealEstate = false }) {
  const icons = hideRealEstate ? FIVE_BOARD_STOCK_ICONS : [...STOCK_ICONS, ...ESTATE_ICONS]
  return (
    <div className={styles.slide}>
      <h2 className={styles.title}>흥미로운 결과도 있어요!</h2>
      <p className={styles.body}>{hideRealEstate ? '게임마다 주식 가격이 달랐다는 점인데요!' : '게임마다 주식과 부동산 가격이 달랐다는 점인데요!'}</p>
      <ul className={styles.icons} aria-hidden="true">
        {icons.map((src, i) => (
          <li key={src} className={styles.icon} style={{ '--delay': `${300 + i * 120}ms` }}>
            <img src={src} alt="" />
          </li>
        ))}
      </ul>
    </div>
  )
}
