export class Barrier {
  private resolvers: (() => void)[] = []

  public join() {
    return new Promise((resolve) => {
      this.resolvers.push(resolve)
    })
  }

  public arrive() {
    const resolvers = this.resolvers
    this.resolvers = []
    setTimeout(() => {
      for (const resolver of resolvers) {
        resolver()
      }
    }, 0)
  }
}
